import {
  Controller,
  Get,
  UseGuards,
  UnauthorizedException,
  Delete,
  Param,
  ForbiddenException,
  Post,
  Body,
  Patch,
  Req,
  DefaultValuePipe,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/generated/prisma';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserWithSession } from '@scaffold/types';
import { RequestWithUser } from './interfaces/user-request.interface';
import { DeviceService } from '../auth/services/device/device.service';
import { DeviceInfoDto } from 'src/auth/dto/mobile-auth.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthCookieService } from '@/auth/services/auth-cookie/auth-cookie.service';
import { AuthEventType } from '@/logging/interfaces/event-types';
import { LoggingService } from '@/logging/services/logging/logging.service';
import { Request } from 'express';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
    private authCookieService: AuthCookieService,
    private deviceService: DeviceService,
    private loggingService: LoggingService,
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

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
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
    @Req() req: Request,
  ) {
    const device = await this.deviceService.trustDevice(user.id, data.deviceId);

    this.loggingService.logSecurityEvent({
      level: 'info',
      userId: user.id,
      event: AuthEventType.DEVICE_TRUSTED,
      success: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: data.deviceId,
      requestId: req.headers['x-request-id'] as string,
      details: {
        deviceId: data.deviceId,
        trustedAt: new Date(),
      },
    });

    return device;
  }

  @Delete('devices/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Remove a device' })
  async removeDevice(
    @CurrentUser() user: User,
    @Param('id') deviceId: string,
    @Req() req: Request,
  ) {
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

    this.loggingService.logSecurityEvent({
      level: 'info',
      userId: user.id,
      event: AuthEventType.DEVICE_REMOVED,
      success: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: deviceId,
      requestId: req.headers['x-request-id'] as string,
      details: {
        deviceId: deviceId,
        removedAt: new Date(),
      },
    });

    return { success: true };
  }

  @Get('activity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get recent account activity' })
  async getRecentActivity(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('type') type?: string,
    @Query('from') from?: string,
  ) {
    // Parse the from date if provided
    const fromDate = from ? new Date(from) : undefined;

    // Parse event types if provided
    const includeEvents = type?.split(',').map((t) => t.trim()) as
      | AuthEventType[]
      | undefined;

    // Cap the limit to a reasonable number
    const cappedLimit = Math.min(limit, 100);

    // Get activities with the specified filters
    return this.loggingService.getRecentActivities(user.id, {
      limit: cappedLimit,
      includeEvents,
      fromDate,
    });
  }

  @Post('register-device')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Register a mobile device' })
  async registerDevice(
    @CurrentUser() user: User,
    @Body() deviceInfo: DeviceInfoDto,
    @Req() req: Request,
  ) {
    const device = await this.deviceService.registerDevice(user.id, deviceInfo);

    this.loggingService.logSecurityEvent({
      level: 'info',
      userId: user.id,
      event: AuthEventType.DEVICE_REGISTERED,
      success: true,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: deviceInfo.deviceId,
      requestId: req.headers['x-request-id'] as string,
      details: {
        deviceId: deviceInfo.deviceId,
        platform: deviceInfo.platform,
        osVersion: deviceInfo.osVersion,
        appVersion: deviceInfo.appVersion,
        registeredAt: new Date(),
      },
    });

    return device;
  }
}
