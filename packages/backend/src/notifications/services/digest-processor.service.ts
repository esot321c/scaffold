import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggingService } from '@/logging/services/logging.service';
import { EmailTemplateService } from './email-template.service';
import { NotificationJob } from '@scaffold/types';
import { Resend } from 'resend';
import { AppConfig } from '@/config/configuration';
import { DIGEST_SCHEDULES } from '../constants/notification.constants';
import { formatTimeZoneDisplay, getTimeZone } from '@scaffold/timezone-utils';
import { Admin } from '@/generated/prisma';

@Injectable()
export class DigestProcessorService implements OnModuleInit {
  private resend: Resend;
  private pendingDigests: Map<string, NotificationJob[]> = new Map();

  constructor(
    private prisma: PrismaService,
    private loggingService: LoggingService,
    private emailTemplateService: EmailTemplateService,
    private config: AppConfig,
  ) {}

  async onModuleInit() {
    this.resend = new Resend(this.config.email.resendApiKey);
    this.loggingService.info(
      'Digest processor initialized',
      'DigestProcessorService',
    );
  }

  /**
   * Add a notification to the digest queue for an admin
   */
  addToDigest(adminId: string, job: NotificationJob): void {
    if (!this.pendingDigests.has(adminId)) {
      this.pendingDigests.set(adminId, []);
    }

    this.pendingDigests.get(adminId)?.push(job);
  }

  /**
   * Scheduled job to send hourly digests
   */
  @Cron(DIGEST_SCHEDULES.hourly)
  async sendHourlyDigests() {
    await this.sendDigestsForFrequency('hourly');
  }

  /**
   * Scheduled job to send daily digests
   */
  @Cron(DIGEST_SCHEDULES.daily)
  async sendDailyDigests() {
    await this.sendDigestsForFrequency('daily');
  }

  /**
   * Send digest emails for admins with the specified frequency
   */
  async sendDigestsForFrequency(frequency: 'hourly' | 'daily') {
    try {
      // For daily digests, let's respect the admin's preferred time in their timezone
      let adminsToProcess: Admin[] = [];

      if (frequency === 'daily') {
        // Get all admins with this frequency setting
        const allAdmins = await this.prisma.admin.findMany({
          where: {
            notificationSettings: {
              // Prisma JSON filtering
              path: ['emailFrequency'],
              equals: frequency,
            },
          },
        });

        // Filter admins based on whether it's their preferred time
        adminsToProcess = allAdmins.filter((admin) => {
          try {
            const settings = JSON.parse(admin.notificationSettings as string);
            if (!settings.enabled) return false;

            // Default to 9 AM if not specified
            const preferredTime = settings.digestTime ?? '09:00';
            const timezone = settings.quietHours?.timezone ?? 'UTC';

            // Calculate if it's time to send in the admin's timezone
            const now = new Date();
            const adminLocalTime = now.toLocaleString('en-US', {
              timeZone: timezone,
              hour: 'numeric',
              minute: 'numeric',
              hour12: false,
            });

            const [currentHour, currentMinute] = adminLocalTime
              .split(':')
              .map(Number);
            const [preferredHour, preferredMinute] = preferredTime
              .split(':')
              .map(Number);

            // Send if we're within the preferred hour
            // We allow 5 minutes past the hour to account for scheduling delays
            return currentHour === preferredHour && currentMinute <= 5;
          } catch (e) {
            // If we can't parse settings, default to excluding this admin
            this.loggingService.warn(
              `Failed to parse notification settings for admin ${admin.id}`,
              'DigestProcessorService',
              { error: e instanceof Error ? e.message : String(e) },
            );
            return false;
          }
        });
      } else {
        // For hourly digests, we process all enabled admins
        adminsToProcess = await this.prisma.admin.findMany({
          where: {
            notificationSettings: {
              path: ['emailFrequency'],
              equals: frequency,
            },
          },
        });
      }

      // Get user data for each admin
      const userIds = adminsToProcess.map((admin) => admin.userId);
      const users = await this.prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });

      // Create a map for quick lookup
      const userMap = new Map(users.map((user) => [user.id, user]));

      this.loggingService.info(
        `Found ${adminsToProcess.length} admins to process for ${frequency} digest`,
        'DigestProcessorService',
      );

      for (const admin of adminsToProcess) {
        const user = userMap.get(admin.userId);
        if (!user) {
          this.loggingService.warn(
            `Admin ${admin.id} has no corresponding user record`,
            'DigestProcessorService',
          );
          continue;
        }

        // Skip if no pending notifications or if disabled
        const pendingEvents = this.pendingDigests.get(admin.id) || [];
        const settings = JSON.parse(admin.notificationSettings as string);

        if (pendingEvents.length === 0 || !settings.enabled) {
          continue;
        }

        try {
          // Render digest email
          const { subject, html } =
            await this.emailTemplateService.renderDigestEmail(
              pendingEvents,
              user.email,
              user.name ?? undefined,
            );

          // Send email via Resend
          const result = await this.resend.emails.send({
            from: this.config.email.fromAddress,
            to: user.email,
            subject,
            html,
          });

          if (result.error) {
            throw new Error(`Resend API error: ${result.error.message}`);
          }

          // Clear pending notifications for this admin
          this.pendingDigests.set(admin.id, []);

          // Update last digest sent timestamp
          await this.prisma.admin.update({
            where: { id: admin.id },
            data: { lastDigestSent: new Date() },
          });

          this.loggingService.info(
            `Sent ${frequency} digest with ${pendingEvents.length} events to ${user.email}`,
            'DigestProcessorService',
          );
        } catch (error) {
          this.loggingService.error(
            `Failed to send ${frequency} digest to admin ${admin.id}`,
            'DigestProcessorService',
            error as Error,
          );
          // Don't clear pending notifications so they can be retried next time
        }
      }
    } catch (error) {
      this.loggingService.error(
        `Error processing ${frequency} digests`,
        'DigestProcessorService',
        error as Error,
      );
    }
  }

  /**
   * Manually send a digest for a specific admin
   */
  async sendManualDigest(adminId: string): Promise<boolean> {
    try {
      const admin = await this.prisma.admin.findUnique({
        where: { id: adminId },
      });

      if (!admin) {
        throw new Error(`Admin not found: ${adminId}`);
      }

      const user = await this.prisma.user.findUnique({
        where: { id: admin.userId },
      });

      if (!user) {
        throw new Error(`User not found for admin: ${adminId}`);
      }

      const pendingEvents = this.pendingDigests.get(adminId) || [];
      if (pendingEvents.length === 0) {
        return false; // No events to send
      }

      // Render and send digest
      const { subject, html } =
        await this.emailTemplateService.renderDigestEmail(
          pendingEvents,
          user.email,
          user.name ?? undefined,
        );

      const result = await this.resend.emails.send({
        from: this.config.email.fromAddress,
        to: user.email,
        subject,
        html,
      });

      if (result.error) {
        throw new Error(`Resend API error: ${result.error.message}`);
      }

      // Clear pending notifications
      this.pendingDigests.set(adminId, []);

      // Update last digest sent timestamp
      await this.prisma.admin.update({
        where: { id: adminId },
        data: { lastDigestSent: new Date() },
      });

      return true;
    } catch (error) {
      this.loggingService.error(
        `Failed to send manual digest for admin ${adminId}`,
        'DigestProcessorService',
        error as Error,
      );
      return false;
    }
  }
}
