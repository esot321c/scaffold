import { Injectable } from '@nestjs/common';
import * as handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  NotificationEventType,
  NotificationEventData,
  NotificationJob,
} from '@scaffold/types';
import { AuthEventType, SystemEventType } from '@scaffold/types';
import { EMAIL_TEMPLATES } from '../constants/notification.constants';
import { LoggingService } from '@/logging/services/logging.service';

interface EmailTemplateContext {
  adminName?: string;
  eventTitle: string;
  eventDescription: string;
  eventType: string;
  severity: string;
  timestamp: string;
  details: Record<string, any>;
  actionUrl?: string;
  unsubscribeUrl: string;
  appName: string;
  supportEmail: string;
}

@Injectable()
export class EmailTemplateService {
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> =
    new Map();

  constructor(private loggingService: LoggingService) {}

  async onModuleInit() {
    // Register helper for date formatting
    handlebars.registerHelper('formatDate', (timestamp) => {
      try {
        return new Date(timestamp).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (e) {
        return 'Invalid date';
      }
    });

    handlebars.registerHelper('formatTimestamp', (timestamp, timezone) => {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        timeZone: timezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    });

    await this.compileTemplates();
  }

  async compileTemplates(): Promise<void> {
    try {
      const templateDir = path.join(__dirname, '..', 'templates');

      // Register common partials
      await this.registerPartials(templateDir);

      // Compile main templates
      for (const templateName of Object.values(EMAIL_TEMPLATES)) {
        const templatePath = path.join(templateDir, `${templateName}.hbs`);
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        const compiled = handlebars.compile(templateContent);
        this.compiledTemplates.set(templateName, compiled);
      }
    } catch (error) {
      this.loggingService.error(
        'Failed to compile email templates',
        'EmailTemplateService',
        error as Error,
      );
      throw error;
    }
  }

  private async registerPartials(templateDir: string): Promise<void> {
    const partialsDir = path.join(templateDir, 'partials');
    try {
      const files = await fs.readdir(partialsDir);

      for (const file of files) {
        if (file.endsWith('.hbs')) {
          const partialName = file.replace('.hbs', '');
          const partialContent = await fs.readFile(
            path.join(partialsDir, file),
            'utf-8',
          );
          handlebars.registerPartial(partialName, partialContent);
        }
      }
    } catch (error) {
      // Partials directory might not exist
      this.loggingService.debug(
        'No partials directory found',
        'EmailTemplateService',
      );
    }
  }

  async renderNotificationEmail(
    templateName: string,
    event: NotificationEventType,
    eventData: NotificationEventData,
    adminEmail: string,
    adminName?: string,
  ): Promise<{ subject: string; html: string }> {
    const template = this.compiledTemplates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    const context: EmailTemplateContext = {
      adminName,
      eventTitle: this.getEventTitle(event),
      eventDescription: eventData.description,
      eventType: event,
      severity: eventData.severity,
      timestamp: new Date().toISOString(),
      details: this.formatEventDetails(event, eventData),
      actionUrl: this.getActionUrl(event, eventData),
      unsubscribeUrl: `${process.env.FRONTEND_URL}/admin/notification-settings`,
      appName: 'Scaffold',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@scaffold.app',
    };

    const html = template(context);
    const subject = this.getEmailSubject(event, eventData);

    return { subject, html };
  }

  private getEventTitle(event: NotificationEventType): string {
    const titles: Partial<Record<NotificationEventType, string>> = {
      // Auth events
      [AuthEventType.CSRF_FAILURE]: 'CSRF Protection Failure',
      [AuthEventType.SUSPICIOUS_AUTH_ACTIVITY]:
        'Suspicious Authentication Activity',
      [AuthEventType.FAILED_LOGIN]: 'Failed Login Attempt',

      // System events
      [SystemEventType.SERVICE_DOWN]: 'Service Down',
      [SystemEventType.DATABASE_CONNECTION_LOST]: 'Database Connection Lost',
      [SystemEventType.DATABASE_CONNECTION_RESTORED]:
        'Database Connection Restored',
      [SystemEventType.CRITICAL_ERROR]: 'Critical System Error',
      [SystemEventType.BACKUP_FAILED]: 'Backup Failed',
      [SystemEventType.DISK_SPACE_LOW]: 'Low Disk Space Warning',
      [SystemEventType.MEMORY_USAGE_HIGH]: 'High Memory Usage Warning',
    };

    const title =
      titles[event] ||
      event.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    return title;
  }

  private getEmailSubject(
    event: NotificationEventType,
    data: NotificationEventData,
  ): string {
    const prefix =
      data.severity === 'critical'
        ? '🚨 CRITICAL'
        : data.severity === 'high'
          ? '⚠️ WARNING'
          : '📢';

    return `${prefix} ${this.getEventTitle(event)} - Scaffold Admin Alert`;
  }

  private formatEventDetails(
    event: NotificationEventType,
    data: NotificationEventData,
  ): Record<string, any> {
    const details: Record<string, any> = {};

    // Common details
    if (data.service) details.Service = data.service;

    // Auth event details
    if (data.userId) details['User ID'] = data.userId;
    if (data.userEmail) details['User Email'] = data.userEmail;
    if (data.ipAddress) details['IP Address'] = data.ipAddress;
    if (data.userAgent) details['User Agent'] = data.userAgent;

    // System event details
    if (data.metric !== undefined) details.Metric = data.metric;
    if (data.threshold !== undefined) details.Threshold = data.threshold;
    if (data.duration !== undefined) details.Duration = `${data.duration}s`;

    // Additional details
    if (data.details) {
      Object.assign(details, data.details);
    }

    return details;
  }

  private getActionUrl(
    event: NotificationEventType,
    data: NotificationEventData,
  ): string {
    // Return appropriate admin panel URL based on event type
    const baseUrl = process.env.FRONTEND_URL;

    if (
      [
        AuthEventType.CSRF_FAILURE,
        AuthEventType.SUSPICIOUS_AUTH_ACTIVITY,
      ].includes(event as AuthEventType)
    ) {
      return `${baseUrl}/admin/logs?event=${event}`;
    }

    if (
      event === SystemEventType.DATABASE_CONNECTION_LOST ||
      event === SystemEventType.SERVICE_DOWN
    ) {
      return `${baseUrl}/admin/system/health`;
    }

    return `${baseUrl}/admin`;
  }

  async renderDigestEmail(
    jobs: NotificationJob[],
    adminEmail: string,
    adminName?: string,
    adminTimezone: string = 'UTC',
  ): Promise<{ subject: string; html: string }> {
    const template = this.compiledTemplates.get(EMAIL_TEMPLATES.DIGEST);
    if (!template) {
      throw new Error('Digest template not found');
    }

    // Format jobs with timezone-aware timestamps
    const enhancedJobs = jobs.map((job) => ({
      ...job,
      formattedTime: this.formatEventTime(
        job.metadata.timestamp,
        adminTimezone,
      ),
    }));

    const groupedEvents = this.groupEventsByType(enhancedJobs);
    const summary = this.calculateSummary(enhancedJobs);
    const period = this.getDigestPeriod(enhancedJobs);

    const context = {
      adminName,
      period,
      groupedEvents,
      summary,
      unsubscribeUrl: `${process.env.FRONTEND_URL}/admin/notification-settings`,
      adminPanelUrl: `${process.env.FRONTEND_URL}/admin/logs`,
      appName: 'Scaffold',
      totalEvents: jobs.length,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@scaffold.app',
      currentYear: new Date().getFullYear(),
    };

    const html = template(context);

    // Construct a subject line based on the summary
    let subject = 'Scaffold Admin Digest';

    if (summary.critical > 0 || summary.high > 0) {
      subject = `${subject}: ${summary.critical} critical, ${summary.high} high priority events`;
    } else if (summary.total > 0) {
      subject = `${subject}: ${summary.total} event${summary.total !== 1 ? 's' : ''}`;
    }

    return { subject, html };
  }

  // Helper method to format a timestamp
  private formatEventTime(timestamp: string, timezone: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return timestamp; // Return the original timestamp if formatting fails
    }
  }

  private groupEventsByType(
    jobs: NotificationJob[],
  ): Record<string, NotificationJob[]> {
    return jobs.reduce(
      (acc, job) => {
        const type = job.event;
        if (!acc[type]) acc[type] = [];
        acc[type].push(job);
        return acc;
      },
      {} as Record<string, NotificationJob[]>,
    );
  }

  private calculateSummary(jobs: NotificationJob[]) {
    return jobs.reduce(
      (acc, job) => {
        acc[job.data.severity] = (acc[job.data.severity] || 0) + 1;
        acc.total++;
        return acc;
      },
      { total: 0, critical: 0, high: 0, normal: 0, low: 0 },
    );
  }

  private getDigestPeriod(jobs: NotificationJob[]): string {
    if (jobs.length === 0) return 'No events';

    const timestamps = jobs.map((j) =>
      new Date(j.metadata.timestamp).getTime(),
    );
    const oldest = new Date(Math.min(...timestamps));
    const newest = new Date(Math.max(...timestamps));

    return `${oldest.toLocaleString()} - ${newest.toLocaleString()}`;
  }
}
