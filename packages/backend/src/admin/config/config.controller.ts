import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../generated/prisma';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminGuard } from '../guards/admin/admin.guard';

@ApiTags('admin')
@Controller('admin/config')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class ConfigController {
  constructor(private prisma: PrismaService) {}

  @Get('log-retention')
  @ApiOperation({ summary: 'Get log retention period in days' })
  async getLogRetention() {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'auth_log_retention_days' },
    });

    return {
      days: config ? parseInt(config.value, 10) : 90,
    };
  }

  @Put('log-retention')
  @ApiOperation({ summary: 'Update log retention period' })
  async updateLogRetention(
    @Body() data: { days: number },
    @CurrentUser() user: User,
  ) {
    const days = Math.max(1, Math.min(365, data.days)); // Limit between 1-365 days

    const config = await this.prisma.systemConfig.upsert({
      where: { key: 'auth_log_retention_days' },
      update: {
        value: days.toString(),
        updatedBy: user.id,
      },
      create: {
        key: 'auth_log_retention_days',
        value: days.toString(),
        description: 'Number of days to retain authentication activity logs',
        updatedBy: user.id,
      },
    });

    return {
      days: parseInt(config.value, 10),
    };
  }
}
