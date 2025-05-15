import { Injectable, OnModuleInit } from '@nestjs/common';
import { Worker, Job, UnrecoverableError } from 'bullmq';
import { LoggingService } from '@/logging/services/logging.service';
import { EmailTemplateService } from '../services/email-template.service';
import { NotificationJob } from '@scaffold/types';
import { NOTIFICATION_QUEUE_NAME } from '../constants/notification.constants';
import { Resend } from 'resend';
import { RedisService } from '@/redis/services/redis.service';
import { AppConfig } from '@/config/configuration';
import { ErrorHandlingService } from '@/common/error-handling/services/error-handling.service';

@Injectable()
export class NotificationProcessor implements OnModuleInit {
  private worker: Worker<NotificationJob>;
  private resend: Resend;

  constructor(
    private redisService: RedisService,
    private loggingService: LoggingService,
    private emailTemplateService: EmailTemplateService,
    private config: AppConfig,
    private errorHandlingService: ErrorHandlingService,
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

    // Set up event listeners
    this.worker.on('completed', (job) => {
      this.loggingService.info(
        'Notification sent successfully',
        'NotificationProcessor',
        { jobId: job.id, adminId: job.data.adminId },
      );
    });

    this.worker.on('failed', (job, error) => {
      if (job) {
        this.loggingService.error(
          'Failed to send notification',
          'NotificationProcessor',
          error,
          { jobId: job.id, adminId: job.data.adminId },
        );
      } else {
        this.loggingService.error(
          'Failed to send notification (job undefined)',
          'NotificationProcessor',
          error,
        );
      }
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
        // Use UnrecoverableError for errors that shouldn't be retried
        throw new UnrecoverableError('Admin email not found in job data');
      }

      // Render email template
      const { subject, html } =
        await this.emailTemplateService.renderNotificationEmail(
          'system-event',
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

      // Check for errors in the Resend response
      if (result.error) {
        const isNonRecoverable =
          this.errorHandlingService.isNonRecoverableError({
            name: result.error.name,
          });

        if (isNonRecoverable) {
          throw new UnrecoverableError(
            `Resend API non-recoverable error: ${result.error.message || JSON.stringify(result.error)}`,
          );
        } else {
          throw new Error(
            `Resend API error: ${result.error.message || JSON.stringify(result.error)}`,
          );
        }
      }

      // Validate that we have a successful email ID
      if (!result.data?.id) {
        throw new Error('Email sent but no ID was returned');
      }

      // Log success
      this.loggingService.info(
        'Email sent successfully',
        'NotificationProcessor',
        {
          adminId,
          event,
          emailId: result.data.id,
        },
      );

      return { success: true, emailId: result.data.id };
    } catch (error) {
      // BullMQ will automatically handle UnrecoverableError instances differently
      // by not retrying the job
      this.loggingService.error(
        error instanceof UnrecoverableError
          ? `Non-recoverable error: ${error.message}`
          : 'Failed to process notification',
        'NotificationProcessor',
        error as Error,
        { adminId, event },
      );

      // Re-throw for BullMQ to handle
      throw error;
    }
  }
}
