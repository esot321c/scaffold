import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { SystemHealthService } from '@/monitoring/services/system-health.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/services/redis.service';
import { getConnectionToken } from '@nestjs/mongoose';
import { SystemHealth } from '@scaffold/types';

describe('HealthController', () => {
  let controller: HealthController;
  let systemHealthService: SystemHealthService;
  let prismaService: PrismaService;
  let redisService: RedisService;
  let mongoConnection: any;

  const mockRedisConnection = {
    ping: jest.fn(),
  };

  const mockMongoConnection = {
    readyState: 1, // Connected
    db: {
      admin: jest.fn().mockReturnValue({
        ping: jest.fn(),
      }),
    },
  };

  const mockSystemHealthService = {
    getCurrentMetrics: jest.fn(),
  };

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const mockRedisService = {
    getConnection: jest.fn().mockReturnValue(mockRedisConnection),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: SystemHealthService,
          useValue: mockSystemHealthService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: getConnectionToken(),
          useValue: mockMongoConnection,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    systemHealthService = module.get<SystemHealthService>(SystemHealthService);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
    mongoConnection = module.get(getConnectionToken());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSystemHealth', () => {
    it('should return healthy status for all services', async () => {
      // Mock successful health checks
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisConnection.ping.mockResolvedValue('PONG');
      mockMongoConnection.db.admin().ping.mockResolvedValue({ ok: 1 });
      mockSystemHealthService.getCurrentMetrics.mockResolvedValue({
        cpuUsage: 45.2,
        memoryUsage: 68.1,
        diskUsage: 23.7,
      });

      const result: SystemHealth = await controller.getSystemHealth();

      expect(result.database.status).toBe('healthy');
      expect(result.redis.status).toBe('healthy');
      expect(result.mongodb.status).toBe('healthy');
      expect(result.system.cpuUsage).toBe(45.2);
      expect(result.system.memoryUsage).toBe(68.1);
      expect(result.system.diskUsage).toBe(23.7);

      // Verify all services were called
      expect(prismaService.$queryRaw).toHaveBeenCalledTimes(1);
      expect(redisService.getConnection).toHaveBeenCalledTimes(1);
      expect(mockRedisConnection.ping).toHaveBeenCalledTimes(1);
      expect(mockMongoConnection.db.admin().ping).toHaveBeenCalledTimes(1);
      expect(systemHealthService.getCurrentMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle database connection failure', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('Connection failed'),
      );
      mockRedisConnection.ping.mockResolvedValue('PONG');
      mockMongoConnection.db.admin().ping.mockResolvedValue({ ok: 1 });
      mockSystemHealthService.getCurrentMetrics.mockResolvedValue({
        cpuUsage: 45.2,
        memoryUsage: 68.1,
        diskUsage: 23.7,
      });

      const result = await controller.getSystemHealth();

      expect(result.database.status).toBe('down');
      expect(result.redis.status).toBe('healthy');
      expect(result.mongodb.status).toBe('healthy');
    });

    it('should handle Redis connection failure', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisConnection.ping.mockRejectedValue(new Error('Redis down'));
      mockMongoConnection.db.admin().ping.mockResolvedValue({ ok: 1 });
      mockSystemHealthService.getCurrentMetrics.mockResolvedValue({
        cpuUsage: 45.2,
        memoryUsage: 68.1,
        diskUsage: 23.7,
      });

      const result = await controller.getSystemHealth();

      expect(result.database.status).toBe('healthy');
      expect(result.redis.status).toBe('down');
      expect(result.mongodb.status).toBe('healthy');
    });

    it('should handle system metrics failure with fallback', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisConnection.ping.mockResolvedValue('PONG');
      mockMongoConnection.db.admin().ping.mockResolvedValue({ ok: 1 });
      mockSystemHealthService.getCurrentMetrics.mockRejectedValue(
        new Error('Metrics collection failed'),
      );

      const result = await controller.getSystemHealth();

      expect(result.database.status).toBe('healthy');
      expect(result.redis.status).toBe('healthy');
      expect(result.mongodb.status).toBe('healthy');
      // Should fallback to safe defaults
      expect(result.system.cpuUsage).toBe(0);
      expect(result.system.memoryUsage).toBe(0);
      expect(result.system.diskUsage).toBe(0);
    });

    it('should mark services as degraded for slow responses', async () => {
      // Simulate slow responses by adding delay to mocks
      mockPrismaService.$queryRaw.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve([{ '?column?': 1 }]), 1200),
          ),
      );
      mockRedisConnection.ping.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('PONG'), 600)),
      );
      mockMongoConnection.db.admin().ping.mockResolvedValue({ ok: 1 });
      mockSystemHealthService.getCurrentMetrics.mockResolvedValue({
        cpuUsage: 45.2,
        memoryUsage: 68.1,
        diskUsage: 23.7,
      });

      const result = await controller.getSystemHealth();

      expect(result.database.status).toBe('degraded'); // > 1000ms
      expect(result.redis.status).toBe('degraded'); // > 500ms
      expect(result.mongodb.status).toBe('healthy');
    });
  });
});
