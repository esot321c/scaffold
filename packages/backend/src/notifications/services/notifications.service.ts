import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggingService } from '@/logging/services/logging.service';
import { NotificationQueueService } from './notification-queue.service';
import { EmailTemplateService } from './email-template.service';
import {
  NotificationEventType,
  NotificationJob,
  AdminNotificationSettings,
  NotificationEventData,
  NotificationPriority,
  NotificationEvent,
} from '@scaffold/types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../constants/notification.constants';
import { DigestProcessorService } from './digest-processor.service';
import { Resend } from 'resend';
import { Admin } from '@/generated/prisma';
import { AppConfig } from '@/config/configuration';
import { OnEvent } from '@nestjs/event-emitter';

interface AdminEmailInfo {
  id: string;
  userId: string;
  email: string;
  name?: string;
  lastRefreshed: Date;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  // Cache of admin emails for fallback during DB outages
  private adminEmailCache: AdminEmailInfo[] = [];

  // Last time the cache was refreshed
  private lastCacheRefresh: Date | null = null;

  // Cache expiry time (1 hour)
  private readonly CACHE_TTL_MS = 60 * 60 * 1000;

  // Emergency admin emails from environment
  private emergencyEmails: string[] = [];

  private resend: Resend;

  constructor(
    private prisma: PrismaService,
    private loggingService: LoggingService,
    private queueService: NotificationQueueService,
    private digestProcessor: DigestProcessorService,
    private emailTemplateService: EmailTemplateService,
    private config: AppConfig,
  ) {
    // Initialize Resend client
    this.resend = new Resend(this.config.email.resendApiKey);

    // Parse emergency emails from environment
    this.parseEmergencyEmails();
  }

  async onModuleInit() {
    // Initial load of admin emails
    await this.refreshAdminEmailCache();

    // Set up periodic refresh (every 15 minutes)
    setInterval(() => this.refreshAdminEmailCache(), 15 * 60 * 1000);
  }

  @OnEvent('notification.send')
  async handleNotificationEvent(payload: NotificationEvent) {
    this.loggingService.info(
      `Received notification event: ${payload.type} from ${payload.source}`,
      'NotificationsService',
      { payload: JSON.stringify(payload) },
    );

    return this.triggerNotification(
      payload.type,
      payload.data,
      payload.source,
      payload.correlationId,
    );
  }

  /**
   * Parse emergency admin emails from environment variable
   */
  private parseEmergencyEmails(): void {
    const envEmails = this.config.email?.emergencyAdminEmails;
    if (!envEmails) {
      this.emergencyEmails = [];
      return;
    }

    this.emergencyEmails = envEmails
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email && this.isValidEmail(email));

    this.loggingService.info(
      `Loaded ${this.emergencyEmails.length} emergency admin emails from environment`,
      'NotificationsService',
    );
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Refresh the admin email cache
   */
  async refreshAdminEmailCache(): Promise<void> {
    try {
      // First, get all admins
      const admins = await this.prisma.admin.findMany();

      if (admins.length === 0) {
        this.loggingService.warn(
          'No admins found in database',
          'NotificationsService',
        );
        return;
      }

      // Get admin user IDs
      const userIds = admins.map((admin) => admin.userId);

      // Then, query users separately
      const users = await this.prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      // Create a map for efficient lookups
      const userMap = new Map(users.map((user) => [user.id, user]));

      // Update the cache
      this.adminEmailCache = admins
        .filter((admin) => userMap.has(admin.userId))
        .map((admin) => {
          const user = userMap.get(admin.userId)!;
          return {
            id: admin.id,
            userId: admin.userId,
            email: user.email,
            name: user.name ?? undefined,
            lastRefreshed: new Date(),
          };
        });

      this.lastCacheRefresh = new Date();
      this.loggingService.info(
        `Refreshed admin email cache: ${this.adminEmailCache.length} emails`,
        'NotificationsService',
      );
    } catch (error) {
      this.loggingService.error(
        'Failed to refresh admin email cache',
        'NotificationsService',
        error as Error,
      );
    }
  }

  /**
   * Get valid admin emails from cache
   */
  private getValidCachedAdminEmails(): AdminEmailInfo[] {
    if (!this.lastCacheRefresh) return [];

    const now = Date.now();
    const expiryTime = this.lastCacheRefresh.getTime() + this.CACHE_TTL_MS;

    // Return cached emails if they're still valid
    if (now < expiryTime) {
      return this.adminEmailCache;
    }

    return [];
  }

  async triggerNotification(
    event: NotificationEventType,
    data: NotificationEventData,
    source: string = 'system',
    correlationId?: string,
  ): Promise<void> {
    try {
      // Flag to track if we need to use emergency notification
      let useEmergency = false;
      let failureError: Error | null = null;

      // Check if it's a critical notification that should always be delivered
      const isCritical = data.severity === 'critical';

      try {
        // Try the normal DB-based notification flow
        // Get all admins
        const admins = await this.prisma.admin.findMany();

        // Get all relevant users in a single query
        const userIds = admins.map((admin) => admin.userId);
        const users = await this.prisma.user.findMany({
          where: {
            id: {
              in: userIds,
            },
          },
        });

        // Create a user lookup map
        const userMap = new Map(users.map((user) => [user.id, user]));

        // Filter eligible admins
        const eligibleAdmins = admins.filter((admin) =>
          this.shouldNotifyAdmin(admin, event, data.severity),
        );

        if (eligibleAdmins.length === 0) {
          this.loggingService.debug(
            'No eligible admins for notification',
            'NotificationsService',
            { event, severity: data.severity },
          );
          return;
        }

        // Create notification jobs for each eligible admin
        const jobs: NotificationJob[] = [];

        for (const admin of eligibleAdmins) {
          const user = userMap.get(admin.userId);
          if (!user) {
            this.loggingService.warn(
              'Admin without corresponding user',
              'NotificationsService',
              { adminId: admin.id, userId: admin.userId },
            );
            continue;
          }

          const job: NotificationJob = {
            adminId: admin.id,
            event,
            data: {
              ...data,
              adminEmail: user.email,
              adminName: user.name ?? undefined,
            },
            metadata: {
              timestamp: new Date().toISOString(),
              priority: data.severity,
              source,
              correlationId,
            },
          };

          const settings = this.parseNotificationSettings(
            admin.notificationSettings,
          );

          try {
            // Try to use the queue system
            if (settings.emailFrequency === 'immediate') {
              await this.queueService.addNotificationJob(job);
            } else {
              this.digestProcessor.addToDigest(admin.id, job);
            }

            jobs.push(job);
          } catch (queueError) {
            // If queue system fails (Redis issue) but notification is critical,
            // flag for emergency delivery
            if (isCritical) {
              useEmergency = true;
              failureError = queueError as Error;

              // Still add to jobs list to track we tried
              jobs.push(job);

              this.loggingService.warn(
                'Queue system failure for critical notification, will use emergency channel',
                'NotificationsService',
                {
                  error:
                    queueError instanceof Error
                      ? queueError.message
                      : String(queueError),
                },
              );
            } else {
              this.loggingService.error(
                'Failed to queue notification',
                'NotificationsService',
                queueError as Error,
                { adminId: admin.id, event },
              );
            }
          }
        }

        this.loggingService.info(
          'Notification triggered',
          'NotificationsService',
          {
            event,
            adminCount: jobs.length,
            severity: data.severity,
            source,
          },
        );

        // If queue failed for critical notifications, use emergency channel
        if (useEmergency && failureError) {
          await this.sendEmergencyNotification(
            event,
            data,
            new Error(`Queue system failure: ${failureError.message}`),
          );
        }
      } catch (dbError) {
        // Database error - fall back to emergency notification
        // Only send emergency notifications for critical issues
        if (isCritical) {
          await this.sendEmergencyNotification(event, data, dbError as Error);
        } else {
          // Log but don't send non-critical notifications during DB outage
          this.loggingService.warn(
            `Skipping non-critical notification during DB outage: ${event}`,
            'NotificationsService',
            { event, severity: data.severity },
          );
        }
      }
    } catch (error) {
      // Last-ditch effort for critical notifications if everything else fails
      if (data.severity === 'critical') {
        try {
          await this.sendEmergencyNotification(
            event,
            data,
            new Error(
              `Catastrophic notification failure: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
        } catch (emergencyError) {
          // At this point, we've tried everything
          this.loggingService.error(
            'CRITICAL: All notification systems failed',
            'NotificationsService',
            emergencyError as Error,
            { event, severity: data.severity },
          );
        }
      } else {
        this.loggingService.error(
          'Failed to trigger notification',
          'NotificationsService',
          error as Error,
          { event, data },
        );
      }
    }
  }

  /**
   * Emergency notification method used when database is unavailable
   */
  public async sendEmergencyNotification(
    event: NotificationEventType,
    data: NotificationEventData,
    dbError: Error,
  ): Promise<void> {
    try {
      // Get admin emails from cache first
      let recipientEmails: string[] = [];
      let adminData: Array<{ email: string; name?: string }> = [];

      // Try to use cache first
      const cachedAdmins = this.getValidCachedAdminEmails();
      if (cachedAdmins.length > 0) {
        adminData = cachedAdmins.map((admin) => ({
          email: admin.email,
          name: admin.name,
        }));
        recipientEmails = cachedAdmins.map((admin) => admin.email);

        this.loggingService.info(
          `Using cached admin emails for emergency notification: ${recipientEmails.length} recipients`,
          'NotificationsService',
        );
      } else {
        // Fall back to emergency emails from env if cache is empty or expired
        recipientEmails = this.emergencyEmails;
        adminData = recipientEmails.map((email) => ({ email }));

        this.loggingService.info(
          `Using fallback emergency emails: ${recipientEmails.length} recipients`,
          'NotificationsService',
        );
      }

      if (recipientEmails.length === 0) {
        this.loggingService.error(
          'No fallback admin emails available for emergency notification',
          'NotificationsService',
          undefined,
          { event },
        );
        return;
      }

      // Add DB error information to the notification
      const enhancedData = {
        ...data,
        details: {
          ...(data.details || {}),
          dbConnectionError: dbError.message,
          emergencyNotification: true,
          timestamp: new Date().toISOString(),
        },
      };

      for (const adminInfo of adminData) {
        try {
          // Render emergency notification template
          const { subject, html } =
            await this.emailTemplateService.renderNotificationEmail(
              'system-event',
              event,
              enhancedData,
              adminInfo.email,
              adminInfo.name,
            );

          // Send email directly via Resend API
          await this.resend.emails.send({
            from: this.config.email.fromAddress,
            to: adminInfo.email,
            subject: `🚨 EMERGENCY: ${subject}`,
            html,
          });

          this.loggingService.info(
            `Sent emergency notification to ${adminInfo.email}`,
            'NotificationsService',
            { event, severity: data.severity },
          );
        } catch (emailError) {
          this.loggingService.error(
            `Failed to send emergency notification to ${adminInfo.email}`,
            'NotificationsService',
            emailError as Error,
          );
        }
      }
    } catch (error) {
      this.loggingService.error(
        'Failed to send emergency notification',
        'NotificationsService',
        error as Error,
        { event },
      );
    }
  }

  private shouldNotifyAdmin(
    admin: Admin,
    event: NotificationEventType,
    severity: NotificationPriority,
  ): boolean {
    const settings = this.parseNotificationSettings(admin.notificationSettings);

    // Check if notifications are enabled
    if (!settings.enabled) return false;

    // Check if this specific event is enabled
    if (settings.events[event] === false) return false;

    // Check severity filter
    if (settings.severityFilter?.minSeverity) {
      const minSeverityValue = this.getSeverityValue(
        settings.severityFilter.minSeverity,
      );
      const eventSeverityValue = this.getSeverityValue(severity);
      if (eventSeverityValue < minSeverityValue) return false;
    }

    // Check quiet hours (only for non-critical events)
    if (severity !== 'critical' && this.isInQuietHours(settings)) {
      return false;
    }

    return true;
  }

  private parseNotificationSettings(settings: any): AdminNotificationSettings {
    try {
      const parsed =
        typeof settings === 'string' ? JSON.parse(settings) : settings;
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed };
    } catch (error) {
      this.loggingService.warn(
        'Failed to parse notification settings, using defaults',
        'NotificationsService',
        { error: error instanceof Error ? error.message : String(error) },
      );
      return DEFAULT_NOTIFICATION_SETTINGS;
    }
  }

  private getSeverityValue(severity: NotificationPriority): number {
    const values = { low: 1, normal: 2, high: 3, critical: 4 };
    return values[severity] || 2;
  }

  private isInQuietHours(settings: AdminNotificationSettings): boolean {
    if (!settings.quietHours?.enabled) return false;

    const now = new Date();
    const timezone = settings.quietHours.timezone ?? 'UTC';

    // Format the date in the admin's timezone
    const zonedTimeString = now.toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });

    // Extract hours and minutes
    const [hoursStr, minutesStr] = zonedTimeString.split(':');
    const currentHour = parseInt(hoursStr, 10);
    const currentMinute = parseInt(minutesStr, 10);

    const currentTimeValue = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = settings.quietHours.start
      .split(':')
      .map(Number);
    const [endHour, endMinute] = settings.quietHours.end.split(':').map(Number);

    const startValue = startHour * 60 + startMinute;
    const endValue = endHour * 60 + endMinute;

    // Handle overnight quiet hours
    if (startValue > endValue) {
      return currentTimeValue >= startValue || currentTimeValue < endValue;
    } else {
      return currentTimeValue >= startValue && currentTimeValue < endValue;
    }
  }

  async updateAdminNotificationSettings(
    adminId: string,
    settings: Partial<AdminNotificationSettings>,
  ): Promise<AdminNotificationSettings> {
    try {
      const admin = await this.prisma.admin.findUnique({
        where: { id: adminId },
      });

      if (!admin) {
        throw new Error('Admin not found');
      }

      const currentSettings = this.parseNotificationSettings(
        admin.notificationSettings,
      );
      const updatedSettings = { ...currentSettings, ...settings };

      await this.prisma.admin.update({
        where: { id: adminId },
        data: {
          notificationSettings: JSON.stringify(updatedSettings),
        },
      });

      this.loggingService.info(
        'Admin notification settings updated',
        'NotificationsService',
        { adminId },
      );

      return updatedSettings;
    } catch (error) {
      this.loggingService.error(
        'Failed to update admin notification settings',
        'NotificationsService',
        error as Error,
        { adminId },
      );
      throw error;
    }
  }

  async getAdminNotificationSettings(
    adminId: string,
  ): Promise<AdminNotificationSettings> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    return this.parseNotificationSettings(admin.notificationSettings);
  }

  async createOrUpdateAdmin(userId: string): Promise<Admin> {
    return this.prisma.admin.upsert({
      where: { userId },
      create: {
        userId,
        notificationSettings: JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS),
      },
      update: {}, // No update needed
    });
  }
}
