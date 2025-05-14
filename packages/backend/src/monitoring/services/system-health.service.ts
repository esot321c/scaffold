import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '@/notifications/services/notifications.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/services/redis.service';
import { LoggingService } from '@/logging/services/logging.service';
import { SystemEventType } from '@scaffold/types';
import * as os from 'os';
import * as diskusage from 'diskusage';

interface HealthMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  databaseConnected: boolean;
  redisConnected: boolean;
  queueBacklog?: number;
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
    private notificationsService: NotificationsService,
    private prismaService: PrismaService,
    private redisService: RedisService,
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
    const [cpuUsage, memoryUsage, diskUsage, dbConnected, redisConnected] =
      await Promise.all([
        this.getCpuUsage(),
        this.getMemoryUsage(),
        this.getDiskUsage(),
        this.checkDatabaseConnection(),
        this.checkRedisConnection(),
      ]);

    return {
      cpuUsage,
      memoryUsage,
      diskUsage,
      databaseConnected: dbConnected,
      redisConnected: redisConnected,
    };
  }

  private async analyzeMetrics(metrics: HealthMetrics) {
    // Check CPU usage
    if (metrics.cpuUsage > this.CPU_THRESHOLD) {
      await this.notificationsService.triggerNotification(
        SystemEventType.CPU_USAGE_HIGH,
        {
          description: `CPU usage is critically high at ${metrics.cpuUsage.toFixed(1)}%`,
          severity: metrics.cpuUsage > 90 ? 'critical' : 'high',
          metric: metrics.cpuUsage,
          threshold: this.CPU_THRESHOLD,
          service: 'system',
        },
        'system-health',
      );
    }

    // Check memory usage
    if (metrics.memoryUsage > this.MEMORY_THRESHOLD) {
      await this.notificationsService.triggerNotification(
        SystemEventType.MEMORY_USAGE_HIGH,
        {
          description: `Memory usage is critically high at ${metrics.memoryUsage.toFixed(1)}%`,
          severity: metrics.memoryUsage > 95 ? 'critical' : 'high',
          metric: metrics.memoryUsage,
          threshold: this.MEMORY_THRESHOLD,
          service: 'system',
        },
        'system-health',
      );
    }

    // Check disk usage
    if (metrics.diskUsage > this.DISK_THRESHOLD) {
      await this.notificationsService.triggerNotification(
        SystemEventType.DISK_SPACE_LOW,
        {
          description: `Disk usage is critically high at ${metrics.diskUsage.toFixed(1)}%`,
          severity: metrics.diskUsage > 95 ? 'critical' : 'high',
          metric: metrics.diskUsage,
          threshold: this.DISK_THRESHOLD,
          service: 'system',
        },
        'system-health',
      );
    }

    // Check database connection
    if (!metrics.databaseConnected && this.lastMetrics?.databaseConnected) {
      await this.notificationsService.triggerNotification(
        SystemEventType.DATABASE_CONNECTION_LOST,
        {
          description: 'Database connection has been lost',
          severity: 'critical',
          service: 'database',
        },
        'system-health',
      );
    } else if (
      metrics.databaseConnected &&
      !this.lastMetrics?.databaseConnected
    ) {
      await this.notificationsService.triggerNotification(
        SystemEventType.DATABASE_CONNECTION_RESTORED,
        {
          description: 'Database connection has been restored',
          severity: 'normal',
          service: 'database',
        },
        'system-health',
      );
    }

    // Check Redis connection
    if (!metrics.redisConnected && this.lastMetrics?.redisConnected) {
      await this.notificationsService.triggerNotification(
        SystemEventType.QUEUE_FAILURE,
        {
          description:
            'Redis connection has been lost - queue system may be affected',
          severity: 'high',
          service: 'redis',
        },
        'system-health',
      );
    }
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
    const usage = 100 - ~~((100 * idle) / total);

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

  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkRedisConnection(): Promise<boolean> {
    try {
      const client = this.redisService.getConnection();
      await client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Track error rates for high error detection
  @Cron(CronExpression.EVERY_MINUTE)
  async checkErrorRates() {
    const errorCount = this.getRecentErrorCount();

    if (errorCount > this.ERROR_THRESHOLD) {
      await this.notificationsService.triggerNotification(
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
    await this.notificationsService.triggerNotification(
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
    await this.notificationsService.triggerNotification(
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
