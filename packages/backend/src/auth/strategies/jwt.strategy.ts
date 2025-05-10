import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/configuration';
import { Request } from 'express';
import {
  ActivityLogService,
  AuthEventType,
} from '../services/activity-log/activity-log.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: AppConfig,
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.['auth_token'] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.auth.jwtSecret,
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: any) {
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || !session.isValid) {
      // Log invalid session attempt
      if (session?.userId) {
        await this.activityLogService.logActivity(
          session.userId,
          AuthEventType.FAILED_LOGIN,
          false,
          {
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            details: {
              sessionId: payload.sessionId,
              reason: session ? 'invalid_session' : 'session_not_found',
              tokenPayload: JSON.stringify(payload),
            },
          },
        );
      }
      throw new UnauthorizedException('Session invalid or expired');
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      await this.activityLogService.logActivity(
        session.userId,
        AuthEventType.SESSION_EXPIRED,
        false,
        {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          details: {
            sessionId: payload.sessionId,
            expiredAt: session.expiresAt,
          },
        },
      );
      throw new UnauthorizedException('Session expired');
    }

    // Update last active time
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    // Log successful auth verification for sensitive endpoints
    // Only log for non-frequent endpoints to avoid flooding logs
    const sensitiveEndpoints = ['/users/profile', '/auth/sessions'];
    const path = request.path;

    if (sensitiveEndpoints.some((endpoint) => path.includes(endpoint))) {
      await this.activityLogService.logActivity(
        session.userId,
        AuthEventType.TOKEN_REFRESH,
        true,
        {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          sessionId: session.id,
          details: {
            endpoint: request.path,
            method: request.method,
          },
        },
      );
    }

    return {
      ...session.user,
      sessionId: payload.sessionId,
    };
  }
}
