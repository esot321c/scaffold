import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggingService } from '@/logging/services/logging.service';
import { User } from '@/generated/prisma';
import {
  CONFIG_DEFAULTS,
  CONFIG_KEYS,
  LogRetentionSettings,
} from '@scaffold/types';
import { UpdateLogRetentionDto } from '../dto/log-retention.dto';
import { UpdateLoggingConfigDto } from '../dto/logging-config.dto';

@Injectable()
export class ConfigService {
  constructor(
    private prisma: PrismaService,
    private loggingService: LoggingService,
  ) {}

  async getLogRetentionSettings(): Promise<LogRetentionSettings> {
    const [
      securityLogConfig,
      apiLogConfig,
      mongoEnabledConfig,
      fileEnabledConfig,
    ] = await Promise.all([
      this.getConfigValue(CONFIG_KEYS.AUTH_LOG_RETENTION),
      this.getConfigValue(CONFIG_KEYS.API_LOG_RETENTION),
      this.getConfigValue(CONFIG_KEYS.LOGGING_MONGO_ENABLED),
      this.getConfigValue(CONFIG_KEYS.LOGGING_FILE_ENABLED),
    ]);

    return {
      securityLogDays: securityLogConfig
        ? parseInt(securityLogConfig, 10)
        : CONFIG_DEFAULTS.SECURITY_LOG_DAYS,
      apiLogDays: apiLogConfig
        ? parseInt(apiLogConfig, 10)
        : CONFIG_DEFAULTS.API_LOG_DAYS,
      mongoEnabled: mongoEnabledConfig === 'true',
      fileEnabled: fileEnabledConfig !== 'false', // Default to true
    };
  }

  async updateLogRetentionSettings(
    dto: UpdateLogRetentionDto,
    user: User,
  ): Promise<LogRetentionSettings> {
    // Update security log retention
    await this.upsertConfig(
      CONFIG_KEYS.AUTH_LOG_RETENTION,
      dto.securityLogDays.toString(),
      'Number of days to retain security activity logs',
      user.id,
    );

    // Update API log retention
    await this.upsertConfig(
      CONFIG_KEYS.API_LOG_RETENTION,
      dto.apiLogDays.toString(),
      'Number of days to retain API logs',
      user.id,
    );

    // Apply changes to logging service
    await this.loggingService.reconfigureTtlIndexes();

    return this.getLogRetentionSettings();
  }

  async updateLoggingConfiguration(
    dto: UpdateLoggingConfigDto,
    user: User,
  ): Promise<LogRetentionSettings> {
    // Business rule: at least one logging method must be enabled
    if (!dto.mongoEnabled && !dto.fileEnabled) {
      throw new BadRequestException(
        'At least one logging method (MongoDB or file) must be enabled',
      );
    }

    // Update MongoDB logging setting
    await this.upsertConfig(
      CONFIG_KEYS.LOGGING_MONGO_ENABLED,
      dto.mongoEnabled.toString(),
      'Enable MongoDB for advanced logging features',
      user.id,
    );

    // Update file logging setting
    await this.upsertConfig(
      CONFIG_KEYS.LOGGING_FILE_ENABLED,
      dto.fileEnabled.toString(),
      'Enable file-based logging',
      user.id,
    );

    // Apply changes to logging service
    await this.loggingService.reloadConfiguration();

    return this.getLogRetentionSettings();
  }

  private async getConfigValue(key: string): Promise<string | null> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });
    return config?.value ?? null;
  }

  private async upsertConfig(
    key: string,
    value: string,
    description: string,
    updatedBy: string,
  ): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value, updatedBy },
      create: { key, value, description, updatedBy },
    });
  }
}
