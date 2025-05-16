import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationThrottleService } from '@/common/services/notification-throttle.service';
import { SystemEventType } from '@scaffold/types';
import { LoggingService } from '@/logging/services/logging.service';
import * as os from 'os';
import * as diskusage from 'diskusage';

interface HealthMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
}

@Injectable()
export class SystemHealthService implements OnModuleInit {
  private lastMetrics: HealthMetrics | null = null;
  private errorCounts: Map<string, number> = new Map();
  private readonly ERROR_THRESHOLD = 10; // errors per minute
  private readonly CPU_THRESHOLD = 80; // percentage
  private readonly MEMORY_THRESHOLD = 85; // percentage
  private readonly DISK_THRESHOLD = 90; // percentage

  constructor(
    private throttleService: NotificationThrottleService,
    private eventEmitter: EventEmitter2,
    private loggingService: LoggingService,
  ) {}

  async onModuleInit() {
    // Start monitoring immediately
    await this.checkSystemHealth();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkSystemHealth() {
    try {
      const metrics = await this.collectMetrics();
      await this.analyzeMetrics(metrics);
      this.lastMetrics = metrics;
    } catch (error) {
      this.loggingService.error(
        'Failed to check system health',
        'SystemHealthService',
        error as Error,
      );
    }
  }

  private async collectMetrics(): Promise<HealthMetrics> {
    const [cpuUsage, memoryUsage, diskUsage] = await Promise.all([
      this.getCpuUsage(),
      this.getMemoryUsage(),
      this.getDiskUsage(),
    ]);

    return {
      cpuUsage,
      memoryUsage,
      diskUsage,
    };
  }

  /**
   * Analyze collected metrics and trigger notifications if needed
   */
  private async analyzeMetrics(metrics: HealthMetrics) {
    // CPU usage
    if (metrics.cpuUsage > this.CPU_THRESHOLD) {
      const severity = metrics.cpuUsage > 90 ? 'critical' : 'high';
      const eventType = SystemEventType.CPU_USAGE_HIGH;

      if (!this.throttleService.shouldThrottle(eventType, `cpu-${severity}`)) {
        this.emitNotification(
          eventType,
          {
            description: `CPU usage is critically high at ${metrics.cpuUsage.toFixed(1)}%`,
            severity,
            metric: metrics.cpuUsage,
            threshold: this.CPU_THRESHOLD,
            service: 'system',
          },
          'system-health',
        );
      }
    } else if (
      this.lastMetrics?.cpuUsage &&
      this.lastMetrics?.cpuUsage > this.CPU_THRESHOLD &&
      metrics.cpuUsage <= this.CPU_THRESHOLD
    ) {
      // CPU usage recovery
      if (
        !this.throttleService.shouldThrottle(
          SystemEventType.CPU_USAGE_NORMAL,
          'cpu',
        )
      ) {
        this.throttleService.resetThrottle(
          SystemEventType.CPU_USAGE_HIGH,
          'cpu-high',
        );
        this.throttleService.resetThrottle(
          SystemEventType.CPU_USAGE_HIGH,
          'cpu-critical',
        );

        this.emitNotification(
          SystemEventType.CPU_USAGE_NORMAL,
          {
            description: `CPU usage has returned to normal: ${metrics.cpuUsage.toFixed(1)}%`,
            severity: 'normal',
            metric: metrics.cpuUsage,
            threshold: this.CPU_THRESHOLD,
            service: 'system',
          },
          'system-health',
        );
      }
    }

    // Memory usage
    if (metrics.memoryUsage > this.MEMORY_THRESHOLD) {
      const severity = metrics.memoryUsage > 95 ? 'critical' : 'high';
      const eventType = SystemEventType.MEMORY_USAGE_HIGH;

      if (
        !this.throttleService.shouldThrottle(eventType, `memory-${severity}`)
      ) {
        this.emitNotification(
          eventType,
          {
            description: `Memory usage is critically high at ${metrics.memoryUsage.toFixed(1)}%`,
            severity,
            metric: metrics.memoryUsage,
            threshold: this.MEMORY_THRESHOLD,
            service: 'system',
          },
          'system-health',
        );
      }
    } else if (
      this.lastMetrics?.memoryUsage &&
      this.lastMetrics?.memoryUsage > this.MEMORY_THRESHOLD &&
      metrics.memoryUsage <= this.MEMORY_THRESHOLD
    ) {
      // Memory usage recovery
      if (
        !this.throttleService.shouldThrottle(
          SystemEventType.MEMORY_USAGE_NORMAL,
          'memory',
        )
      ) {
        this.throttleService.resetThrottle(
          SystemEventType.MEMORY_USAGE_HIGH,
          'memory-high',
        );
        this.throttleService.resetThrottle(
          SystemEventType.MEMORY_USAGE_HIGH,
          'memory-critical',
        );

        this.emitNotification(
          SystemEventType.MEMORY_USAGE_NORMAL,
          {
            description: `Memory usage has returned to normal: ${metrics.memoryUsage.toFixed(1)}%`,
            severity: 'normal',
            metric: metrics.memoryUsage,
            threshold: this.MEMORY_THRESHOLD,
            service: 'system',
          },
          'system-health',
        );
      }
    }

    // Disk space
    if (metrics.diskUsage > this.DISK_THRESHOLD) {
      const severity = metrics.diskUsage > 95 ? 'critical' : 'high';
      const eventType = SystemEventType.DISK_SPACE_LOW;

      if (!this.throttleService.shouldThrottle(eventType, `disk-${severity}`)) {
        this.emitNotification(
          eventType,
          {
            description: `Disk usage is critically high at ${metrics.diskUsage.toFixed(1)}%`,
            severity,
            metric: metrics.diskUsage,
            threshold: this.DISK_THRESHOLD,
            service: 'system',
          },
          'system-health',
        );
      }
    } else if (
      this.lastMetrics?.diskUsage &&
      this.lastMetrics?.diskUsage > this.DISK_THRESHOLD &&
      metrics.diskUsage <= this.DISK_THRESHOLD
    ) {
      // Disk usage recovery
      if (
        !this.throttleService.shouldThrottle(
          SystemEventType.DISK_SPACE_NORMAL,
          'disk',
        )
      ) {
        this.throttleService.resetThrottle(
          SystemEventType.DISK_SPACE_LOW,
          'disk-high',
        );
        this.throttleService.resetThrottle(
          SystemEventType.DISK_SPACE_LOW,
          'disk-critical',
        );

        this.emitNotification(
          SystemEventType.DISK_SPACE_NORMAL,
          {
            description: `Disk usage has returned to normal: ${metrics.diskUsage.toFixed(1)}%`,
            severity: 'normal',
            metric: metrics.diskUsage,
            threshold: this.DISK_THRESHOLD,
            service: 'system',
          },
          'system-health',
        );
      }
    }
  }

  /**
   * Helper method to emit notification events
   */
  private emitNotification(
    type: SystemEventType,
    data: any,
    source: string = 'system-health',
    correlationId?: string,
  ) {
    this.eventEmitter.emit('notification.send', {
      type,
      data,
      source,
      correlationId,
    });
  }

  private async getCpuUsage(): Promise<number> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - Math.floor((100 * idle) / total);

    return usage;
  }

  private getMemoryUsage(): number {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    return (usedMem / totalMem) * 100;
  }

  private async getDiskUsage(): Promise<number> {
    try {
      const disk = await diskusage.check('/');
      // Calculate used percentage: (total - available) / total * 100
      const used = disk.total - disk.available;
      return (used / disk.total) * 100;
    } catch (error) {
      this.loggingService.error(
        'Failed to check disk usage',
        'SystemHealthService',
        error as Error,
      );
      return 0;
    }
  }

  // Track error rates for high error detection
  @Cron(CronExpression.EVERY_MINUTE)
  async checkErrorRates() {
    const errorCount = this.getRecentErrorCount();

    if (errorCount > this.ERROR_THRESHOLD) {
      this.emitNotification(
        SystemEventType.HIGH_ERROR_RATE,
        {
          description: `Error rate is high with ${errorCount} errors in the last minute`,
          severity: errorCount > this.ERROR_THRESHOLD * 2 ? 'critical' : 'high',
          metric: errorCount,
          threshold: this.ERROR_THRESHOLD,
          service: 'api',
          details: {
            errorTypes: this.getErrorBreakdown(),
          },
        },
        'system-health',
      );
    }

    // Reset error counts for next interval
    this.errorCounts.clear();
  }

  // Public method to record errors (called by exception filter)
  recordError(type: string) {
    const count = this.errorCounts.get(type) || 0;
    this.errorCounts.set(type, count + 1);
  }

  private getRecentErrorCount(): number {
    let total = 0;
    for (const count of this.errorCounts.values()) {
      total += count;
    }
    return total;
  }

  private getErrorBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const [type, count] of this.errorCounts.entries()) {
      breakdown[type] = count;
    }
    return breakdown;
  }

  // Method to manually trigger a service down notification
  async reportServiceDown(serviceName: string, details?: any) {
    this.emitNotification(
      SystemEventType.SERVICE_DOWN,
      {
        description: `Service '${serviceName}' is down`,
        severity: 'critical',
        service: serviceName,
        details,
      },
      'manual-report',
    );
  }

  // Method to report critical errors
  async reportCriticalError(error: Error, context: string) {
    this.emitNotification(
      SystemEventType.CRITICAL_ERROR,
      {
        description: `Critical error in ${context}: ${error.message}`,
        severity: 'critical',
        service: context,
        details: {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
        },
      },
      'error-reporter',
    );
  }
}
