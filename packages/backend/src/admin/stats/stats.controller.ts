import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin/admin.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('admin')
@Controller('admin/stats')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class StatsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  async getStats() {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Run all queries in parallel for better performance
    const [totalUsers, activeSessions, activeUsers24h, failedLogins24h] =
      await Promise.all([
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

        // Active users in last 24 hours
        this.prisma.authActivity
          .findMany({
            where: {
              event: 'login',
              successful: true,
              createdAt: {
                gte: oneDayAgo,
              },
            },
            select: {
              userId: true,
            },
            distinct: ['userId'],
          })
          .then((users) => users.length),

        // Failed logins in last 24 hours
        this.prisma.authActivity.count({
          where: {
            event: 'failed_login',
            successful: false,
            createdAt: {
              gte: oneDayAgo,
            },
          },
        }),
      ]);

    return {
      totalUsers,
      activeUsers24h,
      failedLogins24h,
      totalSessions: activeSessions,
    };
  }
}
