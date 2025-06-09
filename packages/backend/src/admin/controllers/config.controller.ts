import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AdminGuard } from '@/admin/guards/admin.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { User } from '@/generated/prisma';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { LogRetentionSettings } from '@scaffold/types';
import { ConfigService } from '../services/config.service';
import {
  LogRetentionSettingsResponseDto,
  UpdateLoggingConfigDto,
  UpdateLogRetentionDto,
} from '../dto/config.dto';

@ApiTags('admin/config')
@Controller('admin/config')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class ConfigController {
  constructor(private configService: ConfigService) {}

  @Get('log-retention')
  @ApiOperation({ summary: 'Get current log retention settings' })
  @ApiResponse({
    status: 200,
    description: 'Log retention settings retrieved successfully',
    type: LogRetentionSettingsResponseDto,
  })
  async getLogRetentionSettings(): Promise<LogRetentionSettings> {
    return this.configService.getLogRetentionSettings();
  }

  @Put('log-retention')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update log retention periods' })
  @ApiResponse({
    status: 200,
    description: 'Log retention settings updated successfully',
    type: LogRetentionSettingsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async updateLogRetentionSettings(
    @Body() dto: UpdateLogRetentionDto,
    @CurrentUser() user: User,
  ): Promise<LogRetentionSettings> {
    return this.configService.updateLogRetentionSettings(dto, user);
  }

  @Put('logging-config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update logging method configuration' })
  @ApiResponse({
    status: 200,
    description: 'Logging configuration updated successfully',
    type: LogRetentionSettingsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid configuration - at least one logging method required',
  })
  async updateLoggingConfiguration(
    @Body() dto: UpdateLoggingConfigDto,
    @CurrentUser() user: User,
  ): Promise<LogRetentionSettings> {
    return this.configService.updateLoggingConfiguration(dto, user);
  }
}
