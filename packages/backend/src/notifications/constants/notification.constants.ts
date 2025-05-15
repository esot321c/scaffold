import {
  AdminNotificationSettings,
  AuthEventType,
  SystemEventType,
  NotificationPriority,
} from '@scaffold/types';

export const NOTIFICATION_QUEUE_NAME = 'notifications';
export const NOTIFICATION_DIGEST_QUEUE_NAME = 'notification-digests';

export const QUEUE_RETRY_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000, // 5 seconds
  },
  removeOnComplete: {
    age: 24 * 3600, // 24 hours
    count: 100,
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // 7 days
  },
};

export const DEFAULT_NOTIFICATION_SETTINGS: AdminNotificationSettings = {
  enabled: true,
  emailFrequency: 'immediate',
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
    timezone: 'UTC',
  },
  events: {
    // Critical auth events
    [AuthEventType.CSRF_FAILURE]: true,
    [AuthEventType.SUSPICIOUS_AUTH_ACTIVITY]: true,
    [AuthEventType.FAILED_LOGIN]: false,

    // Critical system events
    [SystemEventType.SERVICE_DOWN]: true,
    [SystemEventType.DATABASE_CONNECTION_LOST]: true,
    [SystemEventType.CRITICAL_ERROR]: true,
    [SystemEventType.BACKUP_FAILED]: true,
    [SystemEventType.SECURITY_ALERT]: true,

    // Resource warnings
    [SystemEventType.DISK_SPACE_LOW]: true,
    [SystemEventType.MEMORY_USAGE_HIGH]: true,
    [SystemEventType.CPU_USAGE_HIGH]: true,

    // Less critical events
    [SystemEventType.HIGH_ERROR_RATE]: true,
    [SystemEventType.API_RATE_LIMIT_EXCEEDED]: false,
    [SystemEventType.DATABASE_SLOW_QUERY]: false,

    // Deployment events
    [SystemEventType.DEPLOYMENT_FAILED]: true,
    [SystemEventType.DEPLOYMENT_COMPLETED]: false,
  },
  severityFilter: {
    minSeverity: 'normal',
  },
};

export const EMAIL_TEMPLATES = {
  AUTH_EVENT: 'auth-event',
  SYSTEM_EVENT: 'system-event',
  // DIGEST: 'digest',
  // TEST: 'test-notification',
} as const;

export const SEVERITY_PRIORITIES: Record<NotificationPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export const DIGEST_SCHEDULES = {
  hourly: '0 * * * *', // Every hour
  daily: '0 9 * * *', // 9 AM daily
} as const;

export const NOTIFICATION_LIMITS = {
  maxEventsPerDigest: 100,
  maxRetries: 3,
  rateLimitPerHour: 100,
};
