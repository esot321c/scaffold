import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LoggingService } from '@/logging/services/logging/logging.service';
import { AdminGuard } from '@/admin/guards/admin/admin.guard';
import { AuthEventType } from '@scaffold/types';

@ApiTags('admin')
@Controller('admin/stats')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class StatsController {
  constructor(
    private prisma: PrismaService,
    private loggingService: LoggingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  async getStats() {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Run all queries in parallel for better performance
    const [totalUsers, activeSessions] = await Promise.all([
      // Total users count
      this.prisma.user.count(),

      // Active sessions count
      this.prisma.session.count({
        where: {
          isValid: true,
          expiresAt: {
            gt: new Date(),
          },
        },
      }),
    ]);

    // Get login logs
    const loginLogs = await this.loggingService.getSecurityLogs({
      event: AuthEventType.LOGIN,
      success: true,
      fromDate: oneDayAgo,
    });

    // Count unique users that logged in
    const uniqueUserIds = new Set();
    loginLogs.data.forEach((log) => uniqueUserIds.add(log.userId));
    const activeUsers24h = uniqueUserIds.size;

    // Get failed login counts
    const failedLoginLogs = await this.loggingService.getSecurityLogs({
      event: AuthEventType.FAILED_LOGIN,
      success: false,
      fromDate: oneDayAgo,
    });

    const failedLogins24h = failedLoginLogs.data.length;

    return {
      totalUsers,
      activeUsers24h,
      failedLogins24h,
      totalSessions: activeSessions,
    };
  }
}
