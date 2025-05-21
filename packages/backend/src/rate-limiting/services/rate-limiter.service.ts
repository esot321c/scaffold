import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '@/redis/services/redis.service';
import { PrismaService } from '@/prisma/prisma.service';
import Redis from 'ioredis';
import { LoggingService } from '@/logging/services/logging.service';

/**
 * Configuration for a rate limit rule
 */
export interface RateLimitRule {
  limit: number;
  windowSecs: number;
  fallbackToIp: boolean;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetTime: number;
  retryAfter?: number;
}

@Injectable()
export class RateLimiterService implements OnModuleInit {
  private redis: Redis;

  // Rules ordered by precedence (first match wins)
  private rules: Map<string, RateLimitRule> = new Map();

  // Ordered list of patterns to check
  private orderedPatterns: string[] = ['^/auth/.*', '^/admin/.*', '.*'];

  constructor(
    private redisService: RedisService,
    private prisma: PrismaService,
    private loggingService: LoggingService,
  ) {
    // Set default rules (will be overridden by database values)
    this.rules.set('^/auth/.*', {
      limit: 10,
      windowSecs: 60,
      fallbackToIp: true,
    });
    this.rules.set('^/admin/.*', {
      limit: 30,
      windowSecs: 60,
      fallbackToIp: false,
    });
    this.rules.set('.*', { limit: 60, windowSecs: 60, fallbackToIp: true });
  }

  /**
   * Initialize rate limiting rules when the module loads
   */
  async onModuleInit() {
    try {
      this.redis = this.redisService.getConnection();

      // Verify the connection is working
      await this.redis.ping();

      await this.loadRulesFromDatabase();
      this.loggingService.info(
        'Rate limit rules loaded successfully',
        'RateLimiterService',
      );
    } catch (error) {
      this.loggingService.error(
        'Failed to initialize rate limiter',
        'RateLimiterService',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Load rate limit configurations from SystemConfig table
   */
  async loadRulesFromDatabase() {
    // Get all rate limit configurations
    const configs = await this.prisma.systemConfig.findMany({
      where: {
        key: {
          in: ['rate_limit_auth', 'rate_limit_admin', 'rate_limit_api'],
        },
      },
    });

    // Create a map for easier lookup
    const configMap = new Map(
      configs.map((config) => [config.key, config.value]),
    );

    // Update rules if configurations exist
    if (configMap.has('rate_limit_auth')) {
      const limit = parseInt(configMap.get('rate_limit_auth') || '10', 10);
      this.rules.set('^/auth/.*', {
        limit,
        windowSecs: 60,
        fallbackToIp: true,
      });
    }

    if (configMap.has('rate_limit_admin')) {
      const limit = parseInt(configMap.get('rate_limit_admin') || '30', 10);
      this.rules.set('^/admin/.*', {
        limit,
        windowSecs: 60,
        fallbackToIp: false,
      });
    }

    if (configMap.has('rate_limit_api')) {
      const limit = parseInt(configMap.get('rate_limit_api') || '60', 10);
      this.rules.set('.*', {
        limit,
        windowSecs: 60,
        fallbackToIp: true,
      });
    }

    // Log the loaded configurations
    this.loggingService.info(
      'Rate limit rules loaded from database',
      'RateLimiterService',
      {
        auth: this.rules.get('^/auth/.*')?.limit,
        admin: this.rules.get('^/admin/.*')?.limit,
        api: this.rules.get('.*')?.limit,
      },
    );
  }

  /**
   * Find the appropriate rate limit rule for a given path
   */
  private getRuleForPath(path: string): RateLimitRule {
    // Check patterns in the order they're defined
    for (const pattern of this.orderedPatterns) {
      if (new RegExp(pattern).test(path)) {
        return this.rules.get(pattern)!;
      }
    }

    // Fallback to default (most generous) rule
    return this.rules.get('.*')!;
  }

  /**
   * Check if a request should be rate limited
   * @param path Request path
   * @param userId User ID if authenticated
   * @param ip Client IP address
   */
  async checkRateLimit(
    path: string,
    userId?: string,
    ip?: string,
  ): Promise<RateLimitResult> {
    try {
      if (!this.redis) {
        this.loggingService.warn(
          'Redis connection not available, allowing request',
          'RateLimiterService',
        );
        return this.allowRequestWithDefaultValues(path);
      }
      const rule = this.getRuleForPath(path);

      // Determine the key to use for rate limiting
      let key: string;

      if (userId) {
        key = `ratelimit:user:${userId}:${path}`;
      } else if (ip && rule.fallbackToIp) {
        key = `ratelimit:ip:${ip}:${path}`;
      } else {
        // If we can't identify the requester, allow the request
        this.loggingService.warn(
          `Unable to identify requester for rate limiting: ${path}`,
          'RateLimiterService',
        );
        return {
          allowed: true,
          remaining: rule.limit,
          limit: rule.limit,
          resetTime: Math.floor(Date.now() / 1000) + rule.windowSecs,
        };
      }

      // Execute Redis commands in a pipeline for efficiency
      const [countResult, ttlResult] = (await this.redis
        .multi()
        .incr(key)
        .pttl(key)
        .exec()) as [[null, string], [null, string]];

      const count = parseInt(countResult[1], 10);
      let ttl = parseInt(ttlResult[1], 10);

      // If this is the first request in the window, set expiration
      if (count === 1) {
        await this.redis.expire(key, rule.windowSecs);
        ttl = rule.windowSecs * 1000;
      }

      // Convert TTL from milliseconds to seconds and ensure it's positive
      const ttlSecs = Math.max(1, Math.ceil(ttl / 1000));

      // Calculate reset time
      const resetTime = Math.floor(Date.now() / 1000) + ttlSecs;

      // Check if limit exceeded
      if (count > rule.limit) {
        return {
          allowed: false,
          remaining: 0,
          limit: rule.limit,
          resetTime,
          retryAfter: ttlSecs,
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, rule.limit - count),
        limit: rule.limit,
        resetTime,
      };
    } catch (error) {
      this.loggingService.error(
        'Rate limit check failed',
        'RateLimiterService',
        error instanceof Error ? error : new Error(String(error)),
      );
      // Fail open - allow the request if rate limiting fails
      return this.allowRequestWithDefaultValues(path);
    }
  }

  /**
   * Get current rate limit values
   */
  async getRateLimits(): Promise<{
    auth: number;
    admin: number;
    api: number;
  }> {
    return {
      auth: this.rules.get('^/auth/.*')?.limit || 10,
      admin: this.rules.get('^/admin/.*')?.limit || 30,
      api: this.rules.get('.*')?.limit || 60,
    };
  }

  /**
   * Update rate limit values
   * @param limits The new limit values
   * @param updatedBy User ID of the admin making the change
   */
  async updateRateLimits(
    limits: {
      auth?: number;
      admin?: number;
      api?: number;
    },
    updatedBy: string,
  ): Promise<void> {
    // Validate each limit is a positive number
    if (limits.auth !== undefined && limits.auth < 1) {
      throw new Error('Auth rate limit must be at least 1');
    }

    if (limits.admin !== undefined && limits.admin < 1) {
      throw new Error('Admin rate limit must be at least 1');
    }

    if (limits.api !== undefined && limits.api < 1) {
      throw new Error('API rate limit must be at least 1');
    }

    // Update auth limit if provided
    if (limits.auth !== undefined) {
      await this.prisma.systemConfig.upsert({
        where: { key: 'rate_limit_auth' },
        update: {
          value: String(limits.auth),
          updatedBy,
        },
        create: {
          key: 'rate_limit_auth',
          value: String(limits.auth),
          description:
            'Rate limit for authentication endpoints (requests per minute)',
          updatedBy,
        },
      });

      // Update in-memory rule
      this.rules.set('^/auth/.*', {
        limit: limits.auth,
        windowSecs: 60,
        fallbackToIp: true,
      });
    }

    // Update admin limit if provided
    if (limits.admin !== undefined) {
      await this.prisma.systemConfig.upsert({
        where: { key: 'rate_limit_admin' },
        update: {
          value: String(limits.admin),
          updatedBy,
        },
        create: {
          key: 'rate_limit_admin',
          value: String(limits.admin),
          description: 'Rate limit for admin endpoints (requests per minute)',
          updatedBy,
        },
      });

      // Update in-memory rule
      this.rules.set('^/admin/.*', {
        limit: limits.admin,
        windowSecs: 60,
        fallbackToIp: false,
      });
    }

    // Update API limit if provided
    if (limits.api !== undefined) {
      await this.prisma.systemConfig.upsert({
        where: { key: 'rate_limit_api' },
        update: {
          value: String(limits.api),
          updatedBy,
        },
        create: {
          key: 'rate_limit_api',
          value: String(limits.api),
          description:
            'Rate limit for general API endpoints (requests per minute)',
          updatedBy,
        },
      });

      // Update in-memory rule
      this.rules.set('.*', {
        limit: limits.api,
        windowSecs: 60,
        fallbackToIp: true,
      });
    }
  }

  /**
   * Manually reset rate limit for a user or IP
   * Useful for testing or handling exceptional cases
   */
  async resetRateLimit(
    path: string,
    userId?: string,
    ip?: string,
  ): Promise<void> {
    try {
      if (!this.redis) {
        return;
      }

      if (userId) {
        await this.redis.del(`ratelimit:user:${userId}:${path}`);
      }

      if (ip) {
        await this.redis.del(`ratelimit:ip:${ip}:${path}`);
      }
    } catch (error) {
      this.loggingService.error(
        'Failed to reset rate limit',
        'RateLimiterService',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private allowRequestWithDefaultValues(path: string): RateLimitResult {
    const rule = this.getRuleForPath(path);
    return {
      allowed: true,
      remaining: rule.limit,
      limit: rule.limit,
      resetTime: Math.floor(Date.now() / 1000) + rule.windowSecs,
    };
  }

  // For testing only
  public setRuleForTesting(pattern: string, config: RateLimitRule): void {
    this.rules.set(pattern, config);
  }

  // For testing only
  public get isUsingRedis(): boolean {
    return this.redis !== undefined;
  }
}
