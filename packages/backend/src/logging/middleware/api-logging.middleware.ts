import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggingService } from '../services/logging.service';
import { ApiLog } from '@scaffold/types';

@Injectable()
export class ApiLoggingMiddleware implements NestMiddleware {
  constructor(private readonly loggingService: LoggingService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip logging for health check endpoints
    if (req.path === '/ping' || req.path === '/health') {
      return next();
    }

    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    // Get user ID if authenticated
    const user = (req as any).user;
    const userId = user?.sub || user?.id;

    // Create response listener
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;

      // Use process.nextTick to avoid blocking the response
      process.nextTick(() => {
        // Only stringify/process request data if we're actually going to log it
        // This improves performance for large payloads
        const logData: Omit<ApiLog, 'timestamp'> = {
          level: res.statusCode >= 400 ? 'warn' : 'info',
          message: `${req.method} ${req.path} ${res.statusCode}`,
          context: 'API',
          requestId,
          userId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseTime,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          // Only process body for non-GET requests and when needed
          metadata: {
            query: Object.keys(req.query).length > 0 ? req.query : undefined,
            // Only sanitize body for non-GET requests to save CPU cycles
            body:
              req.method !== 'GET'
                ? this.loggingService.sanitizeBody(req.body)
                : undefined,
          },
        };

        this.loggingService.logApiCall(logData);
      });
    });

    next();
  }
}
