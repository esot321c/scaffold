import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggingService } from '@/logging/services/logging.service';
import { SystemHealthService } from '@/monitoring/services/system-health.service';

@Catch(HttpException)
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    private loggingService: LoggingService,
    private systemHealthService: SystemHealthService,
  ) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const errorResponse = exception.getResponse();

    // Use the request ID that was set by the middleware
    const requestId = request.headers['x-request-id'] as string;

    // Log the error with LoggingService
    const logData = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId,
      error: errorResponse,
      // Don't log sensitive data in production
      body: process.env.NODE_ENV === 'production' ? '[redacted]' : request.body,
    };

    // Use appropriate log level based on status code
    if (status >= 500) {
      this.loggingService.error(
        `HTTP ${status} Error: ${request.method} ${request.path}`,
        'HttpExceptionFilter',
        exception,
        logData,
      );

      // Record critical errors for health monitoring
      this.systemHealthService.recordError(`HTTP_${status}`);
    } else if (status >= 400) {
      this.loggingService.warn(
        `HTTP ${status} Error: ${request.method} ${request.path}`,
        'HttpExceptionFilter',
        logData,
      );

      // Still record 4xx errors but they're less critical
      this.systemHealthService.recordError(`HTTP_${status}`);
    }

    // Format the error response
    const formattedError = {
      statusCode: status,
      message:
        typeof errorResponse === 'object' && 'message' in errorResponse
          ? errorResponse.message
          : exception.message,
      error: HttpStatus[status],
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
      // Include validation errors if available
      ...(typeof errorResponse === 'object' && 'errors' in errorResponse
        ? { errors: errorResponse.errors }
        : {}),
    };

    response.status(status).json(formattedError);
  }
}
