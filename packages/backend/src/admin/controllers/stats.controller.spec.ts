import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggingService } from '@/logging/services/logging.service';
import { AuthEventType, AdminStats } from '@scaffold/types';

describe('StatsController', () => {
  let controller: StatsController;
  let prismaService: PrismaService;
  let loggingService: LoggingService;

  const mockPrismaService = {
    user: {
      count: jest.fn(),
    },
    session: {
      count: jest.fn(),
    },
  };

  const mockLoggingService = {
    getSecurityLogs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggingService, useValue: mockLoggingService },
      ],
    }).compile();

    controller = module.get<StatsController>(StatsController);
    prismaService = module.get<PrismaService>(PrismaService);
    loggingService = module.get<LoggingService>(LoggingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return admin statistics', async () => {
      // Mock database counts
      mockPrismaService.user.count.mockResolvedValue(100);
      mockPrismaService.session.count.mockResolvedValue(25);

      // Mock login logs with some duplicate users
      const mockLoginLogs = {
        data: [
          { userId: 'user1' },
          { userId: 'user2' },
          { userId: 'user1' }, // duplicate
          { userId: 'user3' },
        ],
      };

      // Mock failed login logs
      const mockFailedLoginLogs = {
        data: [{ userId: 'user4' }, { userId: 'user5' }],
      };

      mockLoggingService.getSecurityLogs
        .mockResolvedValueOnce(mockLoginLogs) // First call for successful logins
        .mockResolvedValueOnce(mockFailedLoginLogs); // Second call for failed logins

      const result: AdminStats = await controller.getStats();

      expect(result).toEqual({
        totalUsers: 100,
        activeUsers24h: 3, // Unique users from login logs
        failedLogins24h: 2,
        totalSessions: 25,
      });

      // Verify correct service calls
      expect(prismaService.user.count).toHaveBeenCalledTimes(1);
      expect(prismaService.session.count).toHaveBeenCalledWith({
        where: {
          isValid: true,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
      });

      expect(loggingService.getSecurityLogs).toHaveBeenCalledTimes(2);
      expect(loggingService.getSecurityLogs).toHaveBeenNthCalledWith(1, {
        event: AuthEventType.LOGIN,
        success: true,
        fromDate: expect.any(Date),
      });
      expect(loggingService.getSecurityLogs).toHaveBeenNthCalledWith(2, {
        event: AuthEventType.FAILED_LOGIN,
        success: false,
        fromDate: expect.any(Date),
      });
    });

    it('should handle empty log data', async () => {
      mockPrismaService.user.count.mockResolvedValue(50);
      mockPrismaService.session.count.mockResolvedValue(10);
      mockLoggingService.getSecurityLogs.mockResolvedValue({ data: [] });

      const result = await controller.getStats();

      expect(result).toEqual({
        totalUsers: 50,
        activeUsers24h: 0,
        failedLogins24h: 0,
        totalSessions: 10,
      });
    });

    it('should use date from 24 hours ago', async () => {
      const beforeTest = new Date();
      beforeTest.setDate(beforeTest.getDate() - 1);

      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.session.count.mockResolvedValue(1);
      mockLoggingService.getSecurityLogs.mockResolvedValue({ data: [] });

      await controller.getStats();

      const afterTest = new Date();
      afterTest.setDate(afterTest.getDate() - 1);

      // Check that fromDate is approximately 24 hours ago
      const loginCall = mockLoggingService.getSecurityLogs.mock.calls[0][0];
      const fromDate = loginCall.fromDate;

      expect(fromDate.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
      expect(fromDate.getTime()).toBeLessThanOrEqual(afterTest.getTime());
    });
  });
});
