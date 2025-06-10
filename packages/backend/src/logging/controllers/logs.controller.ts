import {
  Controller,
  Get,
  Put,
  Query,
  Body,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AdminGuard } from '@/admin/guards/admin.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { User } from '@/generated/prisma';
import { LoggingService } from '../services/logging.service';
import { ConfigService } from '@/admin/services/config.service';
import {
  SecurityLogQueryDto,
  ApiLogQueryDto,
  LogExportQueryDto,
  LogConfigUpdateDto,
  SecurityLogResponseDto,
  ApiLogResponseDto,
  LogConfigResponseDto,
} from '../dto/logs.dto';
import {
  SecurityLog,
  ApiLog,
  LogRetentionSettings,
  PaginatedResponse,
} from '@scaffold/types';

@ApiTags('Logs')
@Controller('logs')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class LogsController {
  constructor(
    private loggingService: LoggingService,
    private configService: ConfigService,
  ) {}

  @Get('security')
  @ApiOperation({
    summary: 'Get security logs with filtering and pagination',
    description:
      'Retrieve security logs with support for filtering by user, event type, success status, date range, and search terms',
  })
  @ApiResponse({
    status: 200,
    description: 'Security logs retrieved successfully',
    type: SecurityLogResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async getSecurityLogs(
    @Query() query: SecurityLogQueryDto,
  ): Promise<PaginatedResponse<SecurityLog>> {
    return this.loggingService.getSecurityLogs({
      page: query.page,
      limit: query.limit,
      userId: query.userId,
      event: query.event,
      success: query.success,
      search: query.search,
      fromDate: query.from,
      toDate: query.to,
    });
  }

  @Get('api')
  @ApiOperation({
    summary: 'Get API logs with filtering and pagination',
    description:
      'Retrieve API request logs with support for filtering by path, method, status code, user, and date range',
  })
  @ApiResponse({
    status: 200,
    description: 'API logs retrieved successfully',
    type: ApiLogResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async getApiLogs(
    @Query() query: ApiLogQueryDto,
  ): Promise<PaginatedResponse<ApiLog>> {
    return this.loggingService.getApiLogs({
      page: query.page,
      limit: query.limit,
      path: query.path,
      method: query.method,
      statusCode: query.statusCode,
      userId: query.userId,
      search: query.search,
      fromDate: query.from,
      toDate: query.to,
    });
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export logs to CSV format',
    description:
      'Download filtered logs as CSV. Supports all the same filtering options as the log retrieval endpoints',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file download started',
    headers: {
      'Content-Type': {
        description: 'text/csv',
        schema: { type: 'string' },
      },
      'Content-Disposition': {
        description: 'attachment; filename="logs.csv"',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid export parameters',
  })
  async exportLogs(@Query() query: LogExportQueryDto, @Res() res: Response) {
    const { type, format, ...filters } = query;

    if (type !== 'security' && type !== 'api') {
      throw new BadRequestException('Export type must be "security" or "api"');
    }

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${type}-logs-${timestamp}.${format}`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );

      if (type === 'security') {
        const logs = await this.loggingService.getSecurityLogs({
          limit: 10000,
          page: 1,
          userId: filters.userId,
          event: filters.event,
          success: filters.success,
          search: filters.search,
          fromDate: filters.from,
          toDate: filters.to,
        });
        this.streamSecurityLogsCsv(logs.data, res);
      } else {
        const logs = await this.loggingService.getApiLogs({
          limit: 10000,
          page: 1,
          path: filters.path,
          method: filters.method,
          statusCode: filters.statusCode,
          userId: filters.userId,
          search: filters.search,
          fromDate: filters.from,
          toDate: filters.to,
        });
        this.streamApiLogsCsv(logs.data, res);
      }
    } catch (error) {
      // Reset headers and send error response if streaming hasn't started
      if (!res.headersSent) {
        res.removeHeader('Content-Type');
        res.removeHeader('Content-Disposition');
        throw error;
      }
      // If streaming has started, we can't recover gracefully
      res.end();
    }
  }

  @Get('config')
  @ApiOperation({
    summary: 'Get current logging configuration',
    description:
      'Retrieve current log retention settings and logging method configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Logging configuration retrieved successfully',
    type: LogConfigResponseDto,
  })
  async getLogConfig(): Promise<LogRetentionSettings> {
    return this.configService.getLogRetentionSettings();
  }

  @Put('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update logging configuration',
    description:
      'Update log retention periods and logging method settings. At least one logging method (MongoDB or file) must remain enabled.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logging configuration updated successfully',
    type: LogConfigResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid configuration - at least one logging method must be enabled',
  })
  async updateLogConfig(
    @Body() dto: LogConfigUpdateDto,
    @CurrentUser() user: User,
  ): Promise<LogRetentionSettings> {
    return this.configService.updateCombinedLogConfiguration(dto, user);
  }

  /**
   * Stream security logs as CSV without creating temp files
   */
  private streamSecurityLogsCsv(logs: SecurityLog[], res: Response): void {
    // CSV headers
    const headers = [
      'timestamp',
      'userId',
      'userEmail',
      'event',
      'success',
      'ipAddress',
      'userAgent',
      'sessionId',
      'details',
    ];

    // Write CSV header
    res.write(headers.join(',') + '\n');

    // Stream each log entry
    for (const log of logs) {
      const row = [
        log.timestamp ? new Date(log.timestamp).toISOString() : '',
        log.userId ?? '',
        log.user?.email ?? '',
        log.event ?? '',
        log.success?.toString() ?? '',
        log.ipAddress ?? '',
        this.escapeCsvValue(log.userAgent ?? ''),
        log.sessionId ?? '',
        this.escapeCsvValue(JSON.stringify(log.details ?? {})),
      ];

      res.write(row.join(',') + '\n');
    }

    res.end();
  }

  /**
   * Stream API logs as CSV without creating temp files
   */
  private streamApiLogsCsv(logs: ApiLog[], res: Response): void {
    // CSV headers
    const headers = [
      'timestamp',
      'method',
      'path',
      'statusCode',
      'responseTime',
      'userId',
      'ipAddress',
      'userAgent',
      'requestId',
    ];

    // Write CSV header
    res.write(headers.join(',') + '\n');

    // Stream each log entry
    for (const log of logs) {
      const row = [
        log.timestamp ? new Date(log.timestamp).toISOString() : '',
        log.method ?? '',
        this.escapeCsvValue(log.path ?? ''),
        log.statusCode?.toString() ?? '',
        log.responseTime?.toString() ?? '',
        log.userId ?? '',
        log.ip ?? '',
        this.escapeCsvValue(log.userAgent ?? ''),
        log.requestId ?? '',
      ];

      res.write(row.join(',') + '\n');
    }

    res.end();
  }

  /**
   * Escape CSV values to handle commas and quotes
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
