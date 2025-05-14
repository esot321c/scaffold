import { AuthEventType, SystemEventType } from '../enums/index.js';

export type NotificationEventType = AuthEventType | SystemEventType;
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped';
export type EmailFrequency = 'immediate' | 'hourly' | 'daily';

export interface NotificationEventData {
  // Common fields
  description: string;
  severity: NotificationPriority;

  // Auth event specific
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;

  // System event specific
  service?: string;
  metric?: number;
  threshold?: number;
  duration?: number; // in seconds

  // Admin notification specific (added by NotificationsService)
  adminEmail?: string;
  adminName?: string;

  // Generic additional data
  details?: Record<string, any>;
}

export interface NotificationJob {
  id?: string;
  adminId: string;
  event: NotificationEventType;
  data: NotificationEventData;
  metadata: {
    timestamp: string;
    priority: NotificationPriority;
    source: string; // service or module that triggered this
    correlationId?: string; // for tracking related events
  };
}

export interface NotificationHistory {
  id: string;
  adminId: string;
  event: NotificationEventType;
  sentAt: string;
  status: NotificationStatus;
  retryCount: number;
  error?: string;
  emailId?: string; // from email service
  data: NotificationEventData;
}

export interface AdminNotificationSettings {
  enabled: boolean;
  emailFrequency: EmailFrequency;
  email?: string; // override admin's default email
  quietHours?: {
    enabled: boolean;
    start: string; // "22:00"
    end: string; // "08:00"
    timezone: string; // "America/New_York"
  };
  events: {
    [K in NotificationEventType]?: boolean;
  };
  severityFilter?: {
    minSeverity: NotificationPriority;
  };
}

export interface NotificationDigest {
  adminId: string;
  period: {
    start: string;
    end: string;
  };
  events: NotificationJob[];
  summary: {
    total: number;
    byType: Record<NotificationEventType, number>;
    bySeverity: Record<NotificationPriority, number>;
  };
}

// Helper type for email template data
export interface EmailTemplateData {
  adminName?: string;
  event: NotificationEventType;
  eventData: NotificationEventData;
  timestamp: string;
  actionUrl?: string;
  unsubscribeUrl: string;
}
