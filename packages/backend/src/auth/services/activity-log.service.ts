import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export enum AuthEventType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  TOKEN_REFRESH = 'token_refresh',
  PASSWORD_RESET = 'password_reset',
  FAILED_LOGIN = 'failed_login',
  SESSION_EXPIRED = 'session_expired',
  DEVICE_TRUSTED = 'device_trusted',
  DEVICE_REMOVED = 'device_removed',
  DEVICE_REGISTERED = 'device_registered',
  SESSION_CREATED = 'session_created',
  SESSION_ROTATED = 'session_rotated',
  SESSION_TERMINATED = 'session_terminated',
  ALL_SESSIONS_TERMINATED = 'all_sessions_terminated',
  CSRF_FAILURE = 'csrf_failure',
  SUSPICIOUS_AUTH_ACTIVITY = 'suspicious_auth_activity',
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);
  constructor(private prisma: PrismaService) {}

  async logActivity(
    userId: string,
    event: AuthEventType,
    successful: boolean = true,
    metadata: {
      ipAddress?: string;
      userAgent?: string;
      deviceId?: string;
      platform?: string;
      sessionId?: string;
      details?: any;
    } = {},
  ) {
    this.logger.log(
      `Activity: ${event} for user ${userId} (success: ${successful})`,
      {
        userId,
        event,
        successful,
        metadata,
      },
    );

    return this.prisma.authActivity.create({
      data: {
        userId,
        event,
        successful,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        deviceId: metadata.deviceId,
        sessionId: metadata.sessionId,
        details: metadata.details ? metadata.details : {},
      },
    });
  }

  async getRecentActivities(userId: string, limit: number = 10) {
    return this.prisma.authActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
