import {
  Controller,
  Get,
  Query,
  UseGuards,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AdminGuard } from '@/admin/guards/admin/admin.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';

import {
  PaginatedResponse,
  ApiLog,
  SecurityLog,
} from '../interfaces/log.types';
import { LoggingService } from '../services/logging/logging.service';
import { AuthEventType } from '../interfaces/event-types';

@ApiTags('admin/logging')
@Controller('admin/logging')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class AdminLogsController {
  constructor(private loggingService: LoggingService) {}

  @Get('security')
  @ApiOperation({ summary: 'Get security logs with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'event', required: false, enum: AuthEventType })
  @ApiQuery({ name: 'success', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getSecurityLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('userId') userId?: string,
    @Query('event') event?: AuthEventType,
    @Query('success', new ParseBoolPipe({ optional: true })) success?: boolean,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<SecurityLog>> {
    return this.loggingService.getSecurityLogs({
      page,
      limit,
      userId,
      event,
      success,
      search,
    });
  }

  @Get('api')
  @ApiOperation({ summary: 'Get API logs with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'path', required: false, type: String })
  @ApiQuery({ name: 'method', required: false, type: String })
  @ApiQuery({ name: 'statusCode', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getApiLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('path') path?: string,
    @Query('method') method?: string,
    @Query('statusCode', new ParseIntPipe({ optional: true }))
    statusCode?: number,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<ApiLog>> {
    return this.loggingService.getApiLogs({
      page,
      limit,
      path,
      method,
      statusCode,
      userId,
      search,
    });
  }

  @Get('security/user/:userId')
  @ApiOperation({ summary: 'Get security logs for a specific user' })
  async getUserSecurityLogs(
    @Param('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<PaginatedResponse<SecurityLog>> {
    return this.loggingService.getSecurityLogs({
      page,
      limit,
      userId,
    });
  }

  @Get('api/user/:userId')
  @ApiOperation({ summary: 'Get API logs for a specific user' })
  async getUserApiLogs(
    @Param('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<PaginatedResponse<ApiLog>> {
    return this.loggingService.getApiLogs({
      page,
      limit,
      userId,
    });
  }
}
