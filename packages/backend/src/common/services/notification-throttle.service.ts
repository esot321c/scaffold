import { Injectable } from '@nestjs/common';
import { LoggingService } from '@/logging/services/logging.service';

interface ThrottleRecord {
  lastNotificationTime: Date;
  count: number;
}

@Injectable()
export class NotificationThrottleService {
  // Map of event type to throttling record
  private throttleMap = new Map<string, ThrottleRecord>();

  // Default throttle window in milliseconds (15 minutes)
  private readonly DEFAULT_THROTTLE_WINDOW_MS = 15 * 60 * 1000;

  // Maximum notifications per throttle window
  private readonly MAX_NOTIFICATIONS_PER_WINDOW = 1;

  constructor(private loggingService: LoggingService) {}

  /**
   * Check if a notification should be throttled
   * @param eventType The type of event
   * @param category Optional category for more granular throttling
   * @param windowMs Override the default throttle window
   * @returns Boolean indicating if the notification should be throttled (true = throttle)
   */
  shouldThrottle(
    eventType: string,
    category: string = 'default',
    windowMs: number = this.DEFAULT_THROTTLE_WINDOW_MS,
  ): boolean {
    const key = `${category}:${eventType}`;
    const now = new Date();
    const record = this.throttleMap.get(key);

    // If no record exists, this is the first notification
    if (!record) {
      this.throttleMap.set(key, {
        lastNotificationTime: now,
        count: 1,
      });
      return false;
    }

    // Check if we're within the throttle window
    const timeSinceLastNotification =
      now.getTime() - record.lastNotificationTime.getTime();

    if (timeSinceLastNotification < windowMs) {
      // Still within the throttle window
      if (record.count >= this.MAX_NOTIFICATIONS_PER_WINDOW) {
        // Already sent the maximum number of notifications in this window
        this.loggingService.info(
          `Throttling notification for ${eventType} (${category})`,
          'NotificationThrottleService',
          {
            timeSinceLastMs: timeSinceLastNotification,
            windowMs,
            count: record.count,
          },
        );
        return true;
      } else {
        // Increment the count
        record.count++;
        this.throttleMap.set(key, record);
        return false;
      }
    } else {
      // Outside the throttle window, reset
      this.throttleMap.set(key, {
        lastNotificationTime: now,
        count: 1,
      });
      return false;
    }
  }

  /**
   * Reset the throttle for a specific event type
   * Useful when a previously failing service recovers
   */
  resetThrottle(eventType: string, category: string = 'default'): void {
    const key = `${category}:${eventType}`;
    this.throttleMap.delete(key);
  }
}
