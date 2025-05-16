import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { LoggingService } from '@/logging/services/logging.service';
import { NotificationJob, NotificationPriority } from '@scaffold/types';
import {
  NOTIFICATION_QUEUE_NAME,
  QUEUE_RETRY_CONFIG,
  SEVERITY_PRIORITIES,
} from '../constants/notification.constants';
import { RedisService } from '@/redis/services/redis.service';

@Injectable()
export class NotificationQueueService implements OnModuleInit {
  private notificationQueue: Queue<NotificationJob>;

  constructor(
    private redisService: RedisService,
    private loggingService: LoggingService,
  ) {}

  async onModuleInit() {
    const connection = this.redisService.getConnection();

    this.notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
      connection,
      defaultJobOptions: QUEUE_RETRY_CONFIG,
    });

    // Initialize worker in NotificationProcessor instead
    this.loggingService.info(
      'Notification queue initialized',
      'NotificationQueueService',
    );
  }

  async addNotificationJob(job: NotificationJob): Promise<void> {
    const priority = this.getPriorityValue(job.metadata.priority);

    await this.notificationQueue.add(`notification:${job.event}`, job, {
      priority,
      delay: this.calculateDelay(job),
    });

    this.loggingService.info(
      'Notification job added to queue',
      'NotificationQueueService',
      {
        adminId: job.adminId,
        event: job.event,
        priority: job.metadata.priority,
      },
    );
  }

  async addBulkNotificationJobs(jobs: NotificationJob[]): Promise<void> {
    const bulkJobs = jobs.map((job) => ({
      name: `notification:${job.event}`,
      data: job,
      opts: {
        priority: this.getPriorityValue(job.metadata.priority),
        delay: this.calculateDelay(job),
      },
    }));

    await this.notificationQueue.addBulk(bulkJobs);

    this.loggingService.info(
      'Bulk notification jobs added to queue',
      'NotificationQueueService',
      {
        count: jobs.length,
        events: jobs.map((j) => j.event),
      },
    );
  }

  private getPriorityValue(priority: NotificationPriority): number {
    return SEVERITY_PRIORITIES[priority];
  }

  private calculateDelay(job: NotificationJob): number {
    // For now, no delay. Could implement quiet hours check here
    return 0;
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.notificationQueue.getWaitingCount(),
      this.notificationQueue.getActiveCount(),
      this.notificationQueue.getCompletedCount(),
      this.notificationQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}
