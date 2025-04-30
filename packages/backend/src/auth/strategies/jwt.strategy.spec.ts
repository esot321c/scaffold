import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfig } from '../../config/configuration';
import { Request } from 'express';
import { ActivityLogService } from '../services/activity-log.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prismaService: PrismaService;
  let activityLogService: ActivityLogService;

  const mockPrismaService = {
    session: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfig = {
    auth: {
      jwtSecret: 'test-secret',
    },
  };

  const mockActivityLogService = {
    logActivity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AppConfig,
          useValue: mockConfig,
        },
        {
          provide: ActivityLogService,
          useValue: mockActivityLogService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prismaService = module.get<PrismaService>(PrismaService);
    activityLogService = module.get<ActivityLogService>(ActivityLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const mockRequest = {
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
      },
    } as Request;

    const mockPayload = {
      sub: 'user-id',
      email: 'test@example.com',
      sessionId: 'session-id',
    };

    it('should return user data when session is valid', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        isValid: true,
        expiresAt: tomorrow,
        user: {
          id: 'user-id',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue({
        ...mockSession,
        lastActiveAt: expect.any(Date),
      });

      const result = await strategy.validate(mockRequest, mockPayload);

      expect(result).toEqual({
        ...mockSession.user,
        sessionId: mockPayload.sessionId,
      });

      expect(prismaService.session.findUnique).toHaveBeenCalledWith({
        where: { id: mockPayload.sessionId },
        include: { user: true },
      });

      expect(prismaService.session.update).toHaveBeenCalledWith({
        where: { id: mockSession.id },
        data: { lastActiveAt: expect.any(Date) },
      });

      // No activity log for successful validation
      expect(activityLogService.logActivity).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException and log when session is invalid', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'session-id',
        userId: 'user-id',
        isValid: false,
        expiresAt: new Date(),
        user: {
          id: 'user-id',
          email: 'test@example.com',
        },
      });

      await expect(strategy.validate(mockRequest, mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(activityLogService.logActivity).toHaveBeenCalledWith(
        'user-id',
        'failed_login',
        false,
        expect.objectContaining({
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          details: expect.objectContaining({
            sessionId: 'session-id',
            reason: 'invalid_session',
          }),
        }),
      );
    });

    it('should throw UnauthorizedException and log when session has expired', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'session-id',
        userId: 'user-id',
        isValid: true,
        expiresAt: yesterday,
        user: {
          id: 'user-id',
          email: 'test@example.com',
        },
      });

      await expect(strategy.validate(mockRequest, mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(activityLogService.logActivity).toHaveBeenCalledWith(
        'user-id',
        'session_expired',
        false,
        expect.objectContaining({
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          details: expect.objectContaining({
            sessionId: 'session-id',
            expiredAt: yesterday,
          }),
        }),
      );
    });

    it('should throw UnauthorizedException when session is not found', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(mockRequest, mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );

      // Cannot log to specific user since no session found
      expect(activityLogService.logActivity).not.toHaveBeenCalled();
    });
  });
});
