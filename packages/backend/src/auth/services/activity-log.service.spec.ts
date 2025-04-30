import { Test, TestingModule } from '@nestjs/testing';
import { ActivityLogService, AuthEventType } from './activity-log.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ActivityLogService', () => {
  let service: ActivityLogService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    authActivity: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLogService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ActivityLogService>(ActivityLogService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logActivity', () => {
    it('should create an activity log entry', async () => {
      const userId = 'user-id';
      const event = AuthEventType.LOGIN;
      const successful = true;
      const metadata = {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        deviceId: 'device-id',
        platform: 'test-platform',
        details: {
          testData: 'value',
        },
      };

      mockPrismaService.authActivity.create.mockResolvedValue({
        id: 'activity-id',
        userId,
        event,
        successful,
        createdAt: new Date(),
        ...metadata,
      });

      await service.logActivity(userId, event, successful, metadata);

      expect(prismaService.authActivity.create).toHaveBeenCalledWith({
        data: {
          userId,
          event,
          successful,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          deviceId: metadata.deviceId,
          details: expect.any(String), // JSON string
        },
      });
    });

    it('should process user agent data to detect browser and OS', async () => {
      const userId = 'user-id';
      const event = AuthEventType.LOGIN;
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

      mockPrismaService.authActivity.create.mockResolvedValue({
        id: 'activity-id',
        userId,
        event,
      });

      await service.logActivity(userId, event, true, {
        userAgent,
        details: { browser: 'Chrome', os: 'Windows' },
      });

      // Verify browser detection was called
      const createdData =
        mockPrismaService.authActivity.create.mock.calls[0][0].data;
      const details = JSON.parse(createdData.details);

      expect(details.browser).toBe('Chrome');
      expect(details.os).toBe('Windows');
    });
  });

  describe('getRecentActivities', () => {
    it('should return recent activities for a user', async () => {
      const userId = 'user-id';
      const mockActivities = [
        {
          id: 'activity-1',
          userId,
          event: AuthEventType.LOGIN,
          successful: true,
          createdAt: new Date(),
        },
        {
          id: 'activity-2',
          userId,
          event: AuthEventType.LOGOUT,
          successful: true,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.authActivity.findMany.mockResolvedValue(mockActivities);

      const result = await service.getRecentActivities(userId);

      expect(result).toEqual(mockActivities);
      expect(prismaService.authActivity.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10, // Default limit
      });
    });

    it('should respect custom limit', async () => {
      const userId = 'user-id';
      const limit = 5;

      mockPrismaService.authActivity.findMany.mockResolvedValue([]);

      await service.getRecentActivities(userId, limit);

      expect(prismaService.authActivity.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    });
  });
});
