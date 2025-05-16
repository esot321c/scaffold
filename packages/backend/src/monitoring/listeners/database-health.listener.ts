import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SystemEventType } from '@scaffold/types';
import { NotificationThrottleService } from '@/common/services/notification-throttle.service';
import { LoggingService } from '@/logging/services/logging.service';

@Injectable()
export class DatabaseHealthListener {
  constructor(
    private throttleService: NotificationThrottleService,
    private eventEmitter: EventEmitter2,
    private loggingService: LoggingService,
  ) {}

  @OnEvent('database.connection.lost')
  handleConnectionLost(payload: any) {
    this.loggingService.warn(
      `Database connection lost: ${payload.error}`,
      'DatabaseHealthListener',
      { error: payload.error },
    );

    if (
      !this.throttleService.shouldThrottle(
        SystemEventType.DATABASE_CONNECTION_LOST,
        'database',
      )
    ) {
      // Forward to notification system with standardized format
      this.eventEmitter.emit('notification.send', {
        type: SystemEventType.DATABASE_CONNECTION_LOST,
        data: {
          description: 'Database connection failure detected',
          severity: 'critical',
          service: 'database',
          details: {
            error: payload.error,
            timestamp: payload.timestamp,
          },
        },
        source: 'database-health-listener',
      });
    }
  }

  @OnEvent('database.connection.restored')
  handleConnectionRestored(payload: any) {
    this.loggingService.info(
      'Database connection restored - handling recovery notification',
      'DatabaseHealthListener',
      { payload },
    );

    // Always reset throttle on recovery
    this.throttleService.resetThrottle(
      SystemEventType.DATABASE_CONNECTION_LOST,
      'database',
    );

    // Never throttle recovery notifications
    this.eventEmitter.emit('notification.send', {
      type: SystemEventType.DATABASE_CONNECTION_RESTORED,
      data: {
        description: 'Database connection has been restored',
        severity: 'normal',
        service: 'database',
        details: {
          timestamp: payload.timestamp,
          recovered: true,
        },
      },
      source: 'database-health-listener',
    });
  }
}
