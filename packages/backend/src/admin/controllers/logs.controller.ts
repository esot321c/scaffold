import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AdminGuard } from '@/admin/guards/admin.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LoggingService } from '@/logging/services/logging.service';
import { AuthEventType, PaginatedResponse, SecurityLog } from '@scaffold/types';

@ApiTags('Admin')
@Controller('admin/logs')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class LogsController {
  constructor(private loggingService: LoggingService) {}

  @Get()
  @ApiOperation({ summary: 'Get security logs with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'event', required: false, enum: AuthEventType })
  @ApiQuery({ name: 'success', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('event') event?: AuthEventType,
    @Query('success', new ParseBoolPipe({ optional: true })) success?: boolean,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<SecurityLog>> {
    return this.loggingService.getSecurityLogs({
      page,
      limit,
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
  async getApiLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('path') path?: string,
    @Query('method') method?: string,
    @Query('statusCode', new ParseIntPipe({ optional: true }))
    statusCode?: number,
    @Query('search') search?: string,
  ) {
    return this.loggingService.getApiLogs({
      page,
      limit,
      path,
      method,
      statusCode,
      search,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Export security logs to CSV' })
  async exportLogs(
    @Res() res: Response,
    @Query('event') event?: AuthEventType,
    @Query('success', new ParseBoolPipe({ optional: true })) success?: boolean,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    // Get all logs without pagination
    const logs = await this.loggingService.getSecurityLogs({
      limit: 10000, // Upper limit for export
      page: 1,
      event,
      success,
      search,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });

    // Create a temporary file for the CSV
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `security-logs-${Date.now()}.csv`);

    // Set up CSV writer
    const csvWriter = createObjectCsvWriter({
      path: tempFilePath,
      header: [
        { id: 'timestamp', title: 'TIMESTAMP' },
        { id: 'userId', title: 'USER_ID' },
        { id: 'event', title: 'EVENT' },
        { id: 'success', title: 'SUCCESS' },
        { id: 'ipAddress', title: 'IP_ADDRESS' },
        { id: 'userAgent', title: 'USER_AGENT' },
        { id: 'details', title: 'DETAILS' },
      ],
    });

    // Format and write the logs
    const records = logs.data.map((log) => ({
      ...log,
      timestamp: log.timestamp
        ? new Date(log.timestamp).toISOString()
        : undefined,
      details: JSON.stringify(log.details || {}),
    }));

    await csvWriter.writeRecords(records);

    // Send the file as download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="security-logs.csv"',
    );

    const fileStream = fs.createReadStream(tempFilePath);
    fileStream.pipe(res);

    // Clean up the file after sending
    fileStream.on('end', () => {
      fs.unlinkSync(tempFilePath);
    });
  }
}
