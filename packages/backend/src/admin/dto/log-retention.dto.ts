import { ApiProperty } from '@nestjs/swagger';
import { CONFIG_CONSTRAINTS, UpdateLogRetentionRequest } from '@scaffold/types';
import { IsInt, Min, Max } from 'class-validator';

export class UpdateLogRetentionDto implements UpdateLogRetentionRequest {
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
