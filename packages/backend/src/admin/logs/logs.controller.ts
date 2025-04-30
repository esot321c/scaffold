import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin/admin.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { createObjectCsvStringifier } from 'csv-writer';
import { Readable } from 'stream';

@ApiTags('admin')
@Controller('admin/logs')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class AdminLogsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get security logs with pagination and filtering' })
  async getLogs(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('event') event?: string,
    @Query('search') search?: string,
  ) {
    // packages/backend/src/admin/logs/logs.controller.ts (continued)
    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100); // Cap at 100 records per page
    const skip = (pageNum - 1) * limitNum;

    // Build the where clause for filtering
    const where: any = {};

    if (event && event !== 'all') {
      where.event = event;
    }

    if (search) {
      where.OR = [
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { ipAddress: { contains: search } },
        { userAgent: { contains: search } },
      ];
    }

    // Get logs with pagination
    const [logs, totalCount] = await Promise.all([
      this.prisma.authActivity.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      this.prisma.authActivity.count({ where }),
    ]);

    // Format the logs for the frontend
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userEmail: log.user?.email ?? 'Unknown',
      event: log.event,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      successful: log.successful,
      details: log.details,
      createdAt: log.createdAt,
    }));

    return {
      logs: formattedLogs,
      hasMore: skip + logs.length < totalCount,
      total: totalCount,
    };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export security logs as CSV' })
  async exportLogs(
    @Res({ passthrough: true }) res: Response,
    @Query('event') event?: string,
    @Query('search') search?: string,
  ): Promise<StreamableFile> {
    // Build the where clause for filtering
    const where: any = {};

    if (event && event !== 'all') {
      where.event = event;
    }

    if (search) {
      where.OR = [
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { ipAddress: { contains: search } },
        { userAgent: { contains: search } },
      ];
    }

    // Get logs for export (limit to reasonable number)
    const logs = await this.prisma.authActivity.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5000, // Reasonable limit for CSV export
    });

    // Format the logs for CSV export
    const formattedLogs = logs.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      user_email: log.user?.email ?? 'Unknown',
      user_id: log.userId,
      event: log.event,
      status: log.successful ? 'Success' : 'Failed',
      ip_address: log.ipAddress ?? 'N/A',
      user_agent: log.userAgent ?? 'N/A',
      details: JSON.stringify(log.details),
    }));

    // Create CSV
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'user_email', title: 'User Email' },
        { id: 'user_id', title: 'User ID' },
        { id: 'event', title: 'Event' },
        { id: 'status', title: 'Status' },
        { id: 'ip_address', title: 'IP Address' },
        { id: 'user_agent', title: 'User Agent' },
        { id: 'details', title: 'Details' },
      ],
    });

    const csvHeader = csvStringifier.getHeaderString();
    const csvBody = csvStringifier.stringifyRecords(formattedLogs);
    const csvContent = csvHeader + csvBody;

    // Set response headers
    const filename = `security-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    res.set({
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': 'text/csv',
    });

    // Create a stream from the CSV string
    const stream = Readable.from(csvContent);
    return new StreamableFile(stream);
  }
}
