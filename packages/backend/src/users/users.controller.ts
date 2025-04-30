import {
  Controller,
  Get,
  UseGuards,
  Req,
  UnauthorizedException,
  Delete,
  Param,
  ForbiddenException,
  Post,
  Body,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/generated/prisma';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserWithSession } from '@scaffold/types';
import { RequestWithUser } from './interfaces/user-request.interface';
import { AuthCookieService } from '../auth/services/auth-cookie.service';
import { DeviceService } from '../auth/services/device.service';
import {
  ActivityLogService,
  AuthEventType,
} from '../auth/services/activity-log.service';
import { DeviceInfoDto } from 'src/auth/dto/mobile-auth.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
    private authCookieService: AuthCookieService,
    private deviceService: DeviceService,
    private activityLogService: ActivityLogService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  async getProfile(
    @Req() req: RequestWithUser,
    @CurrentUser() user: User,
  ): Promise<UserWithSession> {
    const sessionId = req.user?.sessionId;

    if (!sessionId) {
      throw new UnauthorizedException('No session ID found in JWT token');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        expiresAt: true,
        lastActiveAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found or has expired');
    }

    return {
      ...user,
      session: session,
    };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  checkSession() {
    return { valid: true };
  }

  @Get('devices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get all user devices' })
  async getUserDevices(@CurrentUser() user: User) {
    return this.deviceService.getUserDevices(user.id);
  }

  @Post('devices/trust')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Mark a device as trusted' })
  async trustDevice(
    @CurrentUser() user: User,
    @Body() data: { deviceId: string },
  ) {
    const device = await this.deviceService.trustDevice(user.id, data.deviceId);

    await this.activityLogService.logActivity(
      user.id,
      AuthEventType.DEVICE_TRUSTED,
      true,
      { deviceId: data.deviceId },
    );

    return device;
  }

  @Delete('devices/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Remove a device' })
  async removeDevice(@CurrentUser() user: User, @Param('id') deviceId: string) {
    // Check if device belongs to user first
    const device = await this.prisma.device.findUnique({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId,
        },
      },
    });

    if (!device) {
      throw new ForbiddenException('Device not found or not owned by user');
    }

    await this.deviceService.removeDevice(user.id, deviceId);

    await this.activityLogService.logActivity(
      user.id,
      AuthEventType.DEVICE_REMOVED,
      true,
      { deviceId },
    );

    return { success: true };
  }

  @Get('activity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get recent account activity' })
  async getRecentActivity(@CurrentUser() user: User) {
    return this.activityLogService.getRecentActivities(user.id);
  }

  @Post('register-device')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Register a mobile device' })
  async registerDevice(
    @CurrentUser() user: User,
    @Body() deviceInfo: DeviceInfoDto,
  ) {
    const device = await this.deviceService.registerDevice(user.id, deviceInfo);

    await this.activityLogService.logActivity(
      user.id,
      AuthEventType.DEVICE_REGISTERED,
      true,
      {
        deviceId: deviceInfo.deviceId,
        platform: deviceInfo.platform,
      },
    );

    return device;
  }
}
