import { AuthEventType } from '@scaffold/types';
import { LoggingService } from '@/logging/services/logging.service';
import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly loggingService: LoggingService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Skip for GET, HEAD, OPTIONS requests (they should be idempotent)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Check if the request has the auth_token cookie (cookie-based auth)
    const hasAuthCookie = !!req.cookies['auth_token'];

    // If using cookie-based auth, CSRF protection is required
    if (hasAuthCookie) {
      const csrfToken = req.headers['x-csrf-token'];
      const storedToken = req.cookies['csrf_token'];

      if (!csrfToken || !storedToken || csrfToken !== storedToken) {
        // CSRF validation failed
        if (req.user) {
          let userId: string | undefined;
          if (typeof req.user === 'object' && req.user !== null) {
            if ('id' in req.user && typeof req.user.id === 'string') {
              userId = req.user.id;
            } else if ('sub' in req.user && typeof req.user.sub === 'string') {
              userId = req.user.sub;
            }
          }

          if (userId) {
            this.loggingService.logSecurityEvent({
              level: 'warn',
              userId: userId,
              event: AuthEventType.CSRF_FAILURE,
              success: false,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
              requestId: req.headers['x-request-id'] as string,
              details: {
                reason: 'invalid_csrf_token',
                requestPath: req.path,
                requestMethod: req.method,
              },
            });
          }
        }

        throw new ForbiddenException('Invalid CSRF token');
      }
    }

    // For requests without the auth_token cookie (pure Bearer token auth),
    // no CSRF validation is needed

    next();
  }
}
