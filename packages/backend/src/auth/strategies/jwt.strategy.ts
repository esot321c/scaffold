import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { AppConfig } from '@/config/configuration';
import { Request } from 'express';
import { LoggingService } from '@/logging/services/logging.service';
import { AuthEventType } from '@scaffold/types';
import { UserRole } from '@/generated/prisma';

export interface JwtPayload {
  sub: string; // Subject (user ID)
  email: string; // User email
  role: UserRole;
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
    const fromCookie = !!request.cookies?.['auth_token'];
    const fromHeader = !!request.headers?.authorization?.startsWith('Bearer ');

    if (fromCookie && payload.authType === 'bearer') {
      await this.loggingService.logSecurityEvent({
        level: 'warn',
        userId: payload.sub,
        event: AuthEventType.SUSPICIOUS_AUTH_ACTIVITY,
        success: false,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        requestId: request.headers['x-request-id'] as string,
        details: {
          reason: 'bearer_token_in_cookie',
          sessionId: payload.sessionId,
        },
      });
      throw new UnauthorizedException('Invalid authentication method');
    }

    if (fromHeader && !fromCookie && payload.authType === 'cookie') {
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

    // No session validation here - trust the JWT during its lifetime
    // Return user info directly from JWT payload
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    };
  }
}
