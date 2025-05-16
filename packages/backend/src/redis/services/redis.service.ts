import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AppConfig } from '@/config/configuration';
import Redis from 'ioredis';
import { LoggingService } from '@/logging/services/logging.service';
import { SystemEventType } from '@scaffold/types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationThrottleService } from '@/common/services/notification-throttle.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private connection: Redis;
  private redisConnected = false;

  constructor(
    private config: AppConfig,
    private loggingService: LoggingService,
    private eventEmitter: EventEmitter2,
    private throttleService: NotificationThrottleService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.redisConfig.url;
    // BullMQ requires these specific settings
    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
    });

    this.connection.on('connect', () => {
      this.loggingService.info('Redis connected for BullMQ', 'RedisService');
      this.redisConnected = true;

      // Reset the throttle when Redis connects
      this.throttleService.resetThrottle(
        SystemEventType.QUEUE_FAILURE,
        'redis',
      );

      // Send a recovery notification (also throttled)
      if (
        !this.throttleService.shouldThrottle(
          SystemEventType.QUEUE_RECOVERY,
          'redis',
        )
      ) {
        // Emit event for Redis recovery
        this.eventEmitter.emit('notification.send', {
          type: SystemEventType.QUEUE_RECOVERY,
          data: {
            description: 'Redis connection restored',
            severity: 'normal',
            service: 'redis',
            details: {
              timestamp: new Date().toISOString(),
              recoveryEvent: true,
            },
          },
          source: 'redis-service',
        });
      }
    });

    this.connection.on('error', (error) => {
      this.loggingService.error(
        'Redis connection error',
        'RedisService',
        error,
      );

      const wasConnected = this.redisConnected;
      this.redisConnected = false;

      // Only notify on state change or if we should not throttle
      if (
        wasConnected &&
        !this.throttleService.shouldThrottle(
          SystemEventType.QUEUE_FAILURE,
          'redis',
        )
      ) {
        // Emit event for Redis failure
        this.eventEmitter.emit('notification.send', {
          type: SystemEventType.QUEUE_FAILURE,
          data: {
            description: 'Redis connection failure detected',
            severity: 'critical',
            service: 'redis',
            details: {
              error: error.message,
              timestamp: new Date().toISOString(),
            },
          },
          source: 'redis-service',
        });
      }
    });
  }

  async onModuleDestroy() {
    if (this.connection) {
      await this.connection.quit();
      this.loggingService.info('Redis connection closed', 'RedisService');
    }
  }

  /**
   * Get the Redis connection for BullMQ
   */
  getConnection(): Redis {
    if (!this.connection) {
      throw new Error('Redis connection not initialized');
    }
    return this.connection;
  }

  /**
   * Check if Redis is currently connected
   */
  isConnected(): boolean {
    return this.redisConnected;
  }
}
