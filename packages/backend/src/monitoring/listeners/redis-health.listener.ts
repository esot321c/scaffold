import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SystemEventType } from '@scaffold/types';
import { NotificationThrottleService } from '@/common/services/notification-throttle.service';
import { LoggingService } from '@/logging/services/logging.service';

@Injectable()
export class RedisHealthListener {
  constructor(
    private throttleService: NotificationThrottleService,
    private eventEmitter: EventEmitter2,
    private loggingService: LoggingService,
  ) {}

  @OnEvent('redis.connection.lost')
  handleConnectionLost(payload: any) {
    this.loggingService.warn(
      `Redis connection lost: ${payload.error}`,
      'RedisHealthListener',
      { error: payload.error },
    );

    if (
      !this.throttleService.shouldThrottle(
        SystemEventType.QUEUE_FAILURE,
        'redis',
      )
    ) {
      this.eventEmitter.emit('notification.send', {
        type: SystemEventType.QUEUE_FAILURE,
        data: {
          description: 'Redis connection failure detected',
          severity: 'critical',
          service: 'redis',
          details: {
            error: payload.error,
            timestamp: payload.timestamp,
          },
        },
        source: 'redis-health-listener',
      });
    }
  }

  @OnEvent('redis.connection.restored')
  handleConnectionRestored(payload: any) {
    this.loggingService.info(
      'Redis connection restored',
      'RedisHealthListener',
    );

    // Reset throttle on recovery
    this.throttleService.resetThrottle(SystemEventType.QUEUE_FAILURE, 'redis');

    this.eventEmitter.emit('notification.send', {
      type: SystemEventType.QUEUE_RECOVERY,
      data: {
        description: 'Redis connection has been restored',
        severity: 'normal',
        service: 'redis',
        details: {
          timestamp: payload.timestamp,
        },
      },
      source: 'redis-health-listener',
    });
  }
}
