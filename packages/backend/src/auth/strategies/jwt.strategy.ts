import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { AppConfig } from '@/config/configuration';
import { Request } from 'express';
import { LoggingService } from '@/logging/services/logging.service';
import { AuthEventType } from '@scaffold/types';

export interface JwtPayload {
  sub: string; // Subject (user ID)
  email: string; // User email
  sessionId: string; // Associated session ID
  authType: 'cookie' | 'bearer'; // Authentication context
  iat?: number; // Issued at (timestamp, added by JWT library)
  exp?: number; // Expiration time (timestamp, added by JWT library)
}

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

  async validate(request: Request, payload: JwtPayload) {
    // Determine token source to prevent token misuse
    const fromCookie = !!request.cookies?.['auth_token'];
    const fromHeader = !!request.headers?.authorization?.startsWith('Bearer ');

    // Prevent cookie tokens from being used as Bearer tokens
    if (fromHeader && !fromCookie) {
      // Check if this token was meant for cookie-based auth
      if (payload.authType === 'cookie') {
        await this.loggingService.logSecurityEvent({
          level: 'warn',
          userId: payload.sub,
          event: AuthEventType.SUSPICIOUS_AUTH_ACTIVITY,
          success: false,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          requestId: request.headers['x-request-id'] as string,
          details: {
            reason: 'cookie_token_as_bearer',
            sessionId: payload.sessionId,
          },
        });
        throw new UnauthorizedException('Invalid authentication method');
      }
    }

    // Detect conflicting authentication methods
    const hasCookie = !!request.cookies?.['auth_token'];
    const hasAuthHeader =
      !!request.headers?.authorization?.startsWith('Bearer ');

    if (hasCookie && hasAuthHeader) {
      const authCookieValue = request.cookies['auth_token'];
      const authHeaderValue = request.headers.authorization?.substring(7);

      if (authCookieValue !== authHeaderValue) {
        await this.loggingService.logSecurityEvent({
          level: 'warn',
          userId: payload.sub,
          event: AuthEventType.SUSPICIOUS_AUTH_ACTIVITY,
          success: false,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          requestId: request.headers['x-request-id'] as string,
          details: {
            reason: 'conflicting_auth_methods',
            sessionId: payload.sessionId,
          },
        });
        throw new UnauthorizedException('Invalid authentication method');
      }
    }

    // Validate session exists and is active
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || !session.isValid) {
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

    // Check for expired sessions
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

    // Update last active time for session tracking
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    // Log access to sensitive endpoints
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
