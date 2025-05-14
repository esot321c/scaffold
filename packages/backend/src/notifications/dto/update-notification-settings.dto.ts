import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsEnum,
  IsObject,
  ValidateNested,
  IsString,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AdminNotificationSettings,
  EmailFrequency,
  NotificationEventType,
  NotificationPriority,
} from '@scaffold/types';

class QuietHoursDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Start time in 24h format (e.g., "22:00")',
    example: '22:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in HH:MM format',
  })
  start: string;

  @ApiProperty({
    description: 'End time in 24h format (e.g., "08:00")',
    example: '08:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in HH:MM format',
  })
  end: string;

  @ApiProperty({
    description: 'IANA timezone identifier',
    example: 'America/New_York',
  })
  @IsString()
  timezone: string;
}

class SeverityFilterDto {
  @ApiProperty({ enum: ['low', 'normal', 'high', 'critical'] })
  @IsEnum(['low', 'normal', 'high', 'critical'])
  minSeverity: NotificationPriority;
}

export class UpdateNotificationSettingsDto
  implements Partial<AdminNotificationSettings>
{
  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ enum: ['immediate', 'hourly', 'daily'] })
  @IsOptional()
  @IsEnum(['immediate', 'hourly', 'daily'])
  emailFrequency?: EmailFrequency;

  @ApiProperty()
  @IsOptional()
  @IsObject()
  events?: Partial<Record<NotificationEventType, boolean>>;

  @ApiProperty()
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;

  @ApiProperty()
  @IsOptional()
  @ValidateNested()
  @Type(() => SeverityFilterDto)
  severityFilter?: SeverityFilterDto;

  @ApiProperty()
  @IsOptional()
  @IsString()
  email?: string;
}
