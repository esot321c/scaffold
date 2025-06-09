import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { LogRetentionSettings, CONFIG_CONSTRAINTS } from '@scaffold/types';

// Input DTOs
export class UpdateLogRetentionDto {
  @ApiProperty({
    description: 'Number of days to retain security logs',
    minimum: CONFIG_CONSTRAINTS.LOG_RETENTION.MIN_DAYS,
    maximum: CONFIG_CONSTRAINTS.LOG_RETENTION.MAX_DAYS,
    example: 90,
  })
  @IsInt({ message: 'Security log retention must be an integer' })
  @Min(CONFIG_CONSTRAINTS.LOG_RETENTION.MIN_DAYS, {
    message: `Security log retention must be at least ${CONFIG_CONSTRAINTS.LOG_RETENTION.MIN_DAYS} days`,
  })
  @Max(CONFIG_CONSTRAINTS.LOG_RETENTION.MAX_DAYS, {
    message: `Security log retention cannot exceed ${CONFIG_CONSTRAINTS.LOG_RETENTION.MAX_DAYS} days`,
  })
  securityLogDays: number;

  @ApiProperty({
    description: 'Number of days to retain API logs',
    minimum: CONFIG_CONSTRAINTS.LOG_RETENTION.MIN_DAYS,
    maximum: CONFIG_CONSTRAINTS.LOG_RETENTION.MAX_DAYS,
    example: 30,
  })
  @IsInt({ message: 'API log retention must be an integer' })
  @Min(CONFIG_CONSTRAINTS.LOG_RETENTION.MIN_DAYS, {
    message: `API log retention must be at least ${CONFIG_CONSTRAINTS.LOG_RETENTION.MIN_DAYS} days`,
  })
  @Max(CONFIG_CONSTRAINTS.LOG_RETENTION.MAX_DAYS, {
    message: `API log retention cannot exceed ${CONFIG_CONSTRAINTS.LOG_RETENTION.MAX_DAYS} days`,
  })
  apiLogDays: number;
}

export class UpdateLoggingConfigDto {
  @ApiProperty({
    description: 'Enable MongoDB for structured logging',
    example: true,
  })
  @IsBoolean({ message: 'MongoDB enabled must be a boolean value' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  mongoEnabled: boolean;

  @ApiProperty({
    description: 'Enable file-based logging',
    example: true,
  })
  @IsBoolean({ message: 'File enabled must be a boolean value' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  fileEnabled: boolean;
}

// Response DTOs
export class LogRetentionSettingsResponseDto implements LogRetentionSettings {
  @ApiProperty({
    example: 90,
    description: 'Number of days to retain security logs',
  })
  securityLogDays: number;

  @ApiProperty({
    example: 30,
    description: 'Number of days to retain API logs',
  })
  apiLogDays: number;

  @ApiProperty({
    example: true,
    description: 'Whether MongoDB logging is enabled',
  })
  mongoEnabled: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether file logging is enabled',
  })
  fileEnabled: boolean;
}
