import { Test, TestingModule } from '@nestjs/testing';
import { RateLimiterService } from './rate-limiter.service';
import { RedisService } from '@/redis/services/redis.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggingService } from '@/logging/services/logging.service';
import Redis from 'ioredis';

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let redisClient: any; // Use any to avoid TypeScript errors with mocking
  let prisma: jest.Mocked<PrismaService>;
  let logging: jest.Mocked<LoggingService>;

  beforeEach(async () => {
    // Create a simple mock for Redis that handles the multi chaining
    redisClient = {
      multi: jest.fn(),
      incr: jest.fn(),
      pttl: jest.fn(),
      exec: jest.fn(),
      expire: jest.fn(),
      del: jest.fn(),
    };

    // Set up chaining for multi
    redisClient.multi.mockReturnValue(redisClient);
    redisClient.incr.mockReturnValue(redisClient);
    redisClient.pttl.mockReturnValue(redisClient);

    const redisService = {
      getConnection: jest.fn().mockReturnValue(redisClient),
    };

    prisma = {
      systemConfig: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    logging = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggingService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        { provide: RedisService, useValue: redisService },
        { provide: PrismaService, useValue: prisma },
        { provide: LoggingService, useValue: logging },
      ],
    }).compile();

    service = module.get<RateLimiterService>(RateLimiterService);

    // Mock the loadRulesFromDatabase to avoid actually accessing the database during tests
    jest
      .spyOn(service as any, 'loadRulesFromDatabase')
      .mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within the limit', async () => {
      // Mock Redis response - count is 5, still below limit
      redisClient.exec.mockResolvedValue([
        [null, '5'], // count
        [null, '55000'], // ttl in ms
      ]);

      const result = await service.checkRateLimit('/api/data', 'user123');

      expect(redisClient.multi).toHaveBeenCalled();
      expect(redisClient.incr).toHaveBeenCalledWith(
        expect.stringContaining('user:user123'),
      );
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should block requests over the limit', async () => {
      // Mock Redis response - count is over the default limit
      redisClient.exec.mockResolvedValue([
        [null, '61'], // count (over 60 limit)
        [null, '30000'], // ttl in ms
      ]);

      const result = await service.checkRateLimit('/api/data', 'user123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should use IP when user ID not available', async () => {
      redisClient.exec.mockResolvedValue([
        [null, '1'], // First request
        [null, '-1'], // No TTL set yet
      ]);

      await service.checkRateLimit('/api/data', undefined, '1.2.3.4');

      expect(redisClient.incr).toHaveBeenCalledWith(
        expect.stringContaining('ip:1.2.3.4'),
      );
      expect(redisClient.expire).toHaveBeenCalled();
    });

    it('should apply stricter limits to auth endpoints', async () => {
      // Set a rule for auth endpoints directly in the service
      const privateRules = (service as any).rules;
      privateRules.set('^/auth/.*', {
        limit: 10,
        windowSecs: 60,
        fallbackToIp: true,
      });

      // Simulate request to auth endpoint
      redisClient.exec.mockResolvedValue([
        [null, '5'], // count
        [null, '55000'], // ttl in ms
      ]);

      const result = await service.checkRateLimit('/auth/login', 'user123');

      // Should use auth endpoint rule
      expect(result.limit).toBe(10);
    });
  });

  describe('getRateLimits', () => {
    it('should return current rate limits', async () => {
      const limits = await service.getRateLimits();

      expect(limits).toEqual({
        auth: expect.any(Number),
        admin: expect.any(Number),
        api: expect.any(Number),
      });
    });
  });
});
