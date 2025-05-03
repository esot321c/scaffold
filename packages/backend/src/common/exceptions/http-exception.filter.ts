import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from '@nestjs/common';

@Catch(HttpException)
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const errorResponse = exception.getResponse();

    // Use the request ID that was set by the middleware
    const requestId = request.headers['x-request-id'] as string;

    // Log the error with contextual information
    this.logger.error({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId,
      error: errorResponse,
      // Don't log sensitive data in production
      body: process.env.NODE_ENV === 'production' ? '[redacted]' : request.body,
    });

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
