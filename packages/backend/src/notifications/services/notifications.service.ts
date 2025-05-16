import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggingService } from '@/logging/services/logging.service';
import { NotificationQueueService } from './notification-queue.service';
import {
  NotificationEventType,
  NotificationJob,
  AdminNotificationSettings,
  NotificationEventData,
  NotificationPriority,
} from '@scaffold/types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../constants/notification.constants';
import { toZonedTime } from 'date-fns-tz';
import { Admin } from '@/generated/prisma';
import { DigestProcessorService } from './digest-processor.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private loggingService: LoggingService,
    private queueService: NotificationQueueService,
    private digestProcessor: DigestProcessorService,
  ) {}

  async triggerNotification(
    event: NotificationEventType,
    data: NotificationEventData,
    source: string = 'system',
    correlationId?: string,
  ): Promise<void> {
    try {
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

        // Route the notification based on admin preferences
        if (settings.emailFrequency === 'immediate') {
          await this.queueService.addNotificationJob(job);
        } else {
          this.digestProcessor.addToDigest(admin.id, job);
        }

        jobs.push(job);
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
    } catch (error) {
      this.loggingService.error(
        'Failed to trigger notification',
        'NotificationsService',
        error as Error,
        { event, data },
      );
      throw error;
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
