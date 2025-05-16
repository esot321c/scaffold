import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SystemEventType } from '@scaffold/types';
import { NotificationThrottleService } from '@/common/services/notification-throttle.service';
import { LoggingService } from '@/logging/services/logging.service';

@Injectable()
export class MongoDBHealthListener {
  constructor(
    private throttleService: NotificationThrottleService,
    private eventEmitter: EventEmitter2,
    private loggingService: LoggingService,
  ) {}

  @OnEvent('mongodb.connection.lost')
  @OnEvent('mongodb.connection.error')
  handleConnectionIssue(payload: any) {
    this.loggingService.warn(
      'MongoDB connection issue detected',
      'MongoDBHealthListener',
      { error: payload.error },
    );

    if (
      !this.throttleService.shouldThrottle(
        SystemEventType.SERVICE_DOWN,
        'mongodb',
      )
    ) {
      this.eventEmitter.emit('notification.send', {
        type: SystemEventType.SERVICE_DOWN,
        data: {
          description: 'MongoDB connection failure detected',
          severity: 'high', // Not critical since we have fallbacks
          service: 'mongodb',
          details: {
            error: payload.error,
            timestamp: payload.timestamp,
          },
        },
        source: 'mongodb-health-listener',
      });
    }
  }

  @OnEvent('mongodb.connection.restored')
  handleConnectionRestored(payload: any) {
    this.loggingService.info(
      'MongoDB connection restored',
      'MongoDBHealthListener',
    );

    // Reset throttle on recovery
    this.throttleService.resetThrottle(SystemEventType.SERVICE_DOWN, 'mongodb');

    this.eventEmitter.emit('notification.send', {
      type: SystemEventType.SERVICE_RECOVERED,
      data: {
        description: 'MongoDB connection has been restored',
        severity: 'normal',
        service: 'mongodb',
        details: {
          timestamp: payload.timestamp,
        },
      },
      source: 'mongodb-health-listener',
    });
  }
}
