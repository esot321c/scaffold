import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { User } from '@/generated/prisma';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminGuard } from '@/admin/guards/admin.guard';
import { LoggingService } from '@/logging/services/logging.service';
import { LogRetentionSettings } from '@scaffold/types';

@ApiTags('admin')
@Controller('admin/config')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class ConfigController {
  constructor(
    private prisma: PrismaService,
    private loggingService: LoggingService,
  ) {}

  @Get('log-retention')
  @ApiOperation({ summary: 'Get log retention periods' })
  async getLogRetention(): Promise<LogRetentionSettings> {
    // Using Promise.all to fetch all configs in parallel for better performance
    const [
      securityLogConfig,
      apiLogConfig,
      mongoEnabledConfig,
      fileEnabledConfig,
    ] = await Promise.all([
      this.prisma.systemConfig.findUnique({
        where: { key: 'auth_log_retention_days' },
      }),
      this.prisma.systemConfig.findUnique({
        where: { key: 'api_log_retention_days' },
      }),
      this.prisma.systemConfig.findUnique({
        where: { key: 'logging_mongo_enabled' },
      }),
      this.prisma.systemConfig.findUnique({
        where: { key: 'logging_file_enabled' },
      }),
    ]);

    return {
      securityLogDays: securityLogConfig
        ? parseInt(securityLogConfig.value, 10)
        : 90,
      apiLogDays: apiLogConfig ? parseInt(apiLogConfig.value, 10) : 30,
      mongoEnabled: mongoEnabledConfig?.value === 'true',
      fileEnabled: fileEnabledConfig?.value === 'true',
    };
  }

  @Put('log-retention')
  @ApiOperation({ summary: 'Update log retention periods' })
  async updateLogRetention(
    @Body() data: { securityLogDays: number; apiLogDays: number },
    @CurrentUser() user: User,
  ) {
    // Clamp values between 1-365 days
    const securityLogDays = Math.max(1, Math.min(365, data.securityLogDays));
    const apiLogDays = Math.max(1, Math.min(365, data.apiLogDays));

    // Update security log retention
    await this.prisma.systemConfig.upsert({
      where: { key: 'auth_log_retention_days' },
      update: {
        value: securityLogDays.toString(),
        updatedBy: user.id,
      },
      create: {
        key: 'auth_log_retention_days',
        value: securityLogDays.toString(),
        description: 'Number of days to retain security activity logs',
        updatedBy: user.id,
      },
    });

    // Update API log retention
    await this.prisma.systemConfig.upsert({
      where: { key: 'api_log_retention_days' },
      update: {
        value: apiLogDays.toString(),
        updatedBy: user.id,
      },
      create: {
        key: 'api_log_retention_days',
        value: apiLogDays.toString(),
        description: 'Number of days to retain API logs',
        updatedBy: user.id,
      },
    });

    // Reinitialize logging service to apply the new settings
    await this.loggingService.reconfigureTtlIndexes();

    return {
      securityLogDays,
      apiLogDays,
    };
  }

  @Put('logging-config')
  @ApiOperation({ summary: 'Update logging settings' })
  async updateLoggingConfig(
    @Body() data: { mongoEnabled: boolean; fileEnabled: boolean },
    @CurrentUser() user: User,
  ) {
    // Ensure at least one logging method is enabled
    if (!data.mongoEnabled && !data.fileEnabled) {
      data.fileEnabled = true; // Default to file logging if both are disabled
    }

    await this.prisma.systemConfig.upsert({
      where: { key: 'logging_mongo_enabled' },
      update: {
        value: data.mongoEnabled.toString(),
        updatedBy: user.id,
      },
      create: {
        key: 'logging_mongo_enabled',
        value: data.mongoEnabled.toString(),
        description: 'Enable MongoDB for advanced logging features',
        updatedBy: user.id,
      },
    });

    await this.prisma.systemConfig.upsert({
      where: { key: 'logging_file_enabled' },
      update: {
        value: data.fileEnabled.toString(),
        updatedBy: user.id,
      },
      create: {
        key: 'logging_file_enabled',
        value: data.fileEnabled.toString(),
        description: 'Enable file-based logging',
        updatedBy: user.id,
      },
    });

    // Signal logging service to reload config
    await this.loggingService.reloadConfiguration();

    return {
      mongoEnabled: data.mongoEnabled,
      fileEnabled: data.fileEnabled,
    };
  }
}
