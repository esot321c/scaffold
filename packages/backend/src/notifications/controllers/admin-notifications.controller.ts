import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Post,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AdminGuard } from '@/admin/guards/admin.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { User } from '@/generated/prisma';
import { NotificationsService } from '../services/notifications.service';
import { UpdateNotificationSettingsDto } from '../dto/update-notification-settings.dto';
import { AdminNotificationSettings, SystemEventType } from '@scaffold/types';

@ApiTags('Admin')
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT')
export class AdminNotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get admin notification settings' })
  async getSettings(
    @CurrentUser() user: User,
  ): Promise<AdminNotificationSettings> {
    // First ensure admin record exists
    const admin = await this.notificationsService.createOrUpdateAdmin(user.id);
    return this.notificationsService.getAdminNotificationSettings(admin.id);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update admin notification settings' })
  async updateSettings(
    @CurrentUser() user: User,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<AdminNotificationSettings> {
    const admin = await this.notificationsService.createOrUpdateAdmin(user.id);
    return this.notificationsService.updateAdminNotificationSettings(
      admin.id,
      dto,
    );
  }

  @Post('test')
  @HttpCode(204)
  @ApiOperation({ summary: 'Send a test notification' })
  async sendTestNotification(@CurrentUser() user: User): Promise<void> {
    await this.notificationsService.triggerNotification(
      SystemEventType.CRITICAL_ERROR,
      {
        description: 'This is a test notification from the admin panel',
        severity: 'normal',
        details: {
          triggeredBy: user.email,
          timestamp: new Date().toISOString(),
        },
      },
      'admin-test',
    );
  }
}
