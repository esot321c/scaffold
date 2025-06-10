import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggingService } from '@/logging/services/logging.service';
import { User } from '@/generated/prisma';
import {
  CONFIG_DEFAULTS,
  CONFIG_KEYS,
  LogRetentionSettings,
} from '@scaffold/types';
import {
  UpdateLoggingConfigDto,
  UpdateLogRetentionDto,
} from '../dto/config.dto';
import { LogConfigUpdateDto } from '@/logging/dto/logs.dto';

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

  async updateCombinedLogConfiguration(
    dto: LogConfigUpdateDto,
    user: User,
  ): Promise<LogRetentionSettings> {
    // Business rule validation - at least one logging method must be enabled
    if (
      dto.mongoEnabled === false &&
      dto.fileEnabled === false &&
      (dto.mongoEnabled !== undefined || dto.fileEnabled !== undefined)
    ) {
      throw new BadRequestException(
        'At least one logging method (MongoDB or file) must be enabled',
      );
    }

    const currentConfig = await this.getLogRetentionSettings();

    // Handle retention period updates if provided
    if (dto.securityLogDays !== undefined || dto.apiLogDays !== undefined) {
      const retentionUpdate = {
        securityLogDays: dto.securityLogDays ?? currentConfig.securityLogDays,
        apiLogDays: dto.apiLogDays ?? currentConfig.apiLogDays,
      };

      await this.updateLogRetentionSettings(retentionUpdate, user);
    }

    // Handle logging method updates if provided
    if (dto.mongoEnabled !== undefined || dto.fileEnabled !== undefined) {
      const methodUpdate = {
        mongoEnabled: dto.mongoEnabled ?? currentConfig.mongoEnabled,
        fileEnabled: dto.fileEnabled ?? currentConfig.fileEnabled,
      };

      await this.updateLoggingConfiguration(methodUpdate, user);
    }

    return this.getLogRetentionSettings();
  }
}
