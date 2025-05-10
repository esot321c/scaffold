import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggingService } from '../services/logging/logging.service';
import { ApiLog } from '../interfaces/log.types';

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

      // Log the API call asynchronously
      process.nextTick(() => {
        const logData: Omit<ApiLog, 'timestamp'> = {
          level: 'info',
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
          metadata: {
            query: req.query,
            body: this.loggingService.sanitizeBody(req.body),
          },
        };

        this.loggingService.logApiCall(logData);
      });
    });

    next();
  }
}
