import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

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
