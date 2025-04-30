import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';

export enum AuthProvider {
  GOOGLE = 'google',
  // LINKEDIN = 'linkedin',
}

export class DeviceInfoDto {
  @ApiProperty()
  @IsString()
  deviceId: string;

  @ApiProperty()
  @IsString()
  platform: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  osVersion?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  appVersion?: string;
}

export class MobileAuthDto {
  @ApiProperty({ enum: AuthProvider })
  @IsEnum(AuthProvider)
  provider: AuthProvider;

  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ type: DeviceInfoDto })
  @IsObject()
  deviceInfo: DeviceInfoDto;
}
