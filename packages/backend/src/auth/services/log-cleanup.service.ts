import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LogCleanupService {
  private readonly logger = new Logger(LogCleanupService.name);
  private readonly DEFAULT_RETENTION_DAYS = 90;

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldLogs() {
    try {
      // Get retention days from config or use default
      const config = await this.prisma.systemConfig.findUnique({
        where: { key: 'auth_log_retention_days' },
      });

      const retentionDays = config
        ? parseInt(config.value, 10)
        : this.DEFAULT_RETENTION_DAYS;

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete old logs
      const result = await this.prisma.authActivity.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(
        `Cleaned up ${result.count} auth logs older than ${retentionDays} days`,
      );

      return result.count;
    } catch (error) {
      this.logger.error(
        `Failed to clean up old logs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
