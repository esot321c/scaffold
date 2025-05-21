import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterService } from '../services/rate-limiter.service';
import { LoggingService } from '@/logging/services/logging.service';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

/**
 * Metadata key for skipping rate limiting
 */
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

/**
 * Decorator to skip rate limiting for specific endpoints
 */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);

/**
 * Rate limiter guard that checks against Redis
 */
@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rateLimiterService: RateLimiterService,
    private loggingService: LoggingService,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if endpoint is decorated to skip rate limiting
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipRateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return this.checkRateLimit(request, response);
  }

  /**
   * Check rate limit for the current request
   */
  private async checkRateLimit(
    request: Request,
    response: Response,
  ): Promise<boolean> {
    // Get userId from request if authenticated
    let userId: string | undefined = undefined;

    if (request.user) {
      if (typeof request.user === 'object') {
        // Check for common user ID fields
        userId =
          (request.user as any).id ||
          (request.user as any).sub ||
          (request.user as any).userId;
      }
    }

    // Get client IP
    const ip = request.ip;

    // Get path for rate limiting
    const path = request.path;

    try {
      // Check rate limit
      const result = await this.rateLimiterService.checkRateLimit(
        path,
        userId,
        ip,
      );

      // Set rate limit headers
      response.setHeader('X-RateLimit-Limit', `${result.limit}`);
      response.setHeader('X-RateLimit-Remaining', `${result.remaining}`);
      response.setHeader('X-RateLimit-Reset', `${result.resetTime}`);

      if (!result.allowed) {
        // Log rate limit event
        this.loggingService.warn(
          `Rate limit exceeded for ${userId ? `user ${userId}` : `IP ${ip}`} on ${path}`,
          'RateLimiterGuard',
          {
            userId,
            ip,
            path,
            limit: result.limit,
            retryAfter: result.retryAfter,
            requestId: request.headers['x-request-id'] as string,
          },
        );

        // Set Retry-After header
        if (result.retryAfter) {
          response.setHeader('Retry-After', `${result.retryAfter}`);
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests, please try again later',
            error: 'Rate limit exceeded',
            retryAfter: result.retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      // If the error is our own HttpException, rethrow it
      if (error instanceof HttpException) {
        throw error;
      }

      // For other errors (like Redis connection issues), log and allow the request
      // This prevents blocking legitimate requests when the rate limiter has issues
      this.loggingService.error(
        `Error checking rate limit: ${error instanceof Error ? error.message : String(error)}`,
        'RateLimiterGuard',
        error instanceof Error ? error : new Error(String(error)),
      );

      return true;
    }
  }
}
