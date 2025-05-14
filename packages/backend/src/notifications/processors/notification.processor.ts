import { Injectable, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { LoggingService } from '@/logging/services/logging.service';
import { EmailTemplateService } from '../services/email-template.service';
import { NotificationJob } from '@scaffold/types';
import { NOTIFICATION_QUEUE_NAME } from '../constants/notification.constants';
import { Resend } from 'resend';
import { RedisService } from '@/redis/services/redis.service';
import { AppConfig } from '@/config/configuration';

@Injectable()
export class NotificationProcessor implements OnModuleInit {
  private worker: Worker<NotificationJob>;
  private resend: Resend;
  private config: AppConfig;

  constructor(
    private redisService: RedisService,
    private loggingService: LoggingService,
    private emailTemplateService: EmailTemplateService,
  ) {
    this.resend = new Resend(this.config.email.resendApiKey);
  }

  async onModuleInit() {
    const connection = this.redisService.getConnection();

    this.worker = new Worker<NotificationJob>(
      NOTIFICATION_QUEUE_NAME,
      async (job: Job<NotificationJob>) => {
        return this.processNotificationJob(job);
      },
      {
        connection,
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) => {
      this.loggingService.info(
        'Notification sent successfully',
        'NotificationProcessor',
        { jobId: job.id, adminId: job.data.adminId },
      );
    });

    this.worker.on('failed', (job, error) => {
      this.loggingService.error(
        'Failed to send notification',
        'NotificationProcessor',
        error,
        { jobId: job?.id, adminId: job?.data.adminId },
      );
    });

    this.loggingService.info(
      'Notification processor initialized',
      'NotificationProcessor',
    );
  }

  private async processNotificationJob(job: Job<NotificationJob>) {
    const { adminId, event, data, metadata } = job.data;

    try {
      // Extract admin email and name from job data
      const adminEmail = data.adminEmail as string;
      const adminName = data.adminName as string;

      if (!adminEmail) {
        throw new Error('Admin email not found in job data');
      }

      // Render email template
      const { subject, html } =
        await this.emailTemplateService.renderNotificationEmail(
          'system-event', // or determine template based on event type
          event,
          data,
          adminEmail,
          adminName,
        );

      // Send email via Resend
      const result = await this.resend.emails.send({
        from: this.config.email.fromAddress,
        to: adminEmail,
        subject,
        html,
      });

      this.loggingService.info(
        'Email sent successfully',
        'NotificationProcessor',
        {
          adminId,
          event,
          emailId: result.data?.id,
        },
      );

      return { success: true, emailId: result.data?.id };
    } catch (error) {
      this.loggingService.error(
        'Failed to process notification',
        'NotificationProcessor',
        error as Error,
        { adminId, event },
      );
      throw error;
    }
  }
}
