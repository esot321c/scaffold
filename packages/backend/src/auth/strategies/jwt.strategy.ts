import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { AppConfig } from '@/config/configuration';
import { Request } from 'express';
import { LoggingService } from '@/logging/services/logging/logging.service';
import { AuthEventType } from '@/logging/interfaces/event-types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: AppConfig,
    private prisma: PrismaService,
    private loggingService: LoggingService,
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
        await this.loggingService.logSecurityEvent({
          level: 'warn',
          userId: session.userId,
          event: AuthEventType.FAILED_LOGIN,
          success: false,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          requestId: request.headers['x-request-id'] as string,
          details: {
            sessionId: payload.sessionId,
            reason: session ? 'invalid_session' : 'session_not_found',
            tokenPayload: JSON.stringify(payload),
          },
        });
      }
      throw new UnauthorizedException('Session invalid or expired');
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      await this.loggingService.logSecurityEvent({
        level: 'warn',
        userId: session.userId,
        event: AuthEventType.SESSION_EXPIRED,
        success: false,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        requestId: request.headers['x-request-id'] as string,
        details: {
          sessionId: payload.sessionId,
          expiredAt: session.expiresAt,
        },
      });
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
      await this.loggingService.logSecurityEvent({
        level: 'info',
        userId: session.userId,
        event: AuthEventType.TOKEN_REFRESH,
        success: true,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        sessionId: session.id,
        requestId: request.headers['x-request-id'] as string,
        details: {
          endpoint: request.path,
          method: request.method,
        },
      });
    }

    return {
      ...session.user,
      sessionId: payload.sessionId,
    };
  }
}
