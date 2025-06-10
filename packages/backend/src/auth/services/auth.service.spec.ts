import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { LoggingService } from '@/logging/services/logging.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { UserRole } from '@/generated/prisma';
import { AuthEventType } from '@scaffold/types';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: DeepMockProxy<PrismaService>;
  let loggingService: DeepMockProxy<LoggingService>;

  // Reusable mock data
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.USER,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    companyName: null,
    companyLogo: null,
    phone: null,
    address: null,
    website: null,
    lastLoginAt: null,
  };

  const mockSession = {
    id: 'session-123',
    token: 'session-token-abc',
    userId: mockUser.id,
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    isValid: true,
    lastActiveAt: new Date(),
    createdAt: new Date(),
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 (Test Browser)',
    user: mockUser,
  };

  const mockOAuthData = {
    provider: 'google',
    providerId: 'google-123',
    email: mockUser.email,
    firstName: 'Test',
    lastName: 'User',
    accessToken: 'oauth-token',
    refreshToken: 'refresh-token',
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('test-jwt-token'),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        { provide: JwtService, useValue: mockJwtService },
        { provide: LoggingService, useValue: mockDeep<LoggingService>() },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    loggingService = module.get(LoggingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateJwtToken', () => {
    it('should generate cookie token by default', () => {
      const token = service.generateJwtToken(mockUser, mockSession.id);

      expect(token).toBe('test-jwt-token');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        sessionId: mockSession.id,
        authType: 'cookie',
      });
    });

    it('should generate bearer token when forCookie is false', () => {
      service.generateJwtToken(mockUser, mockSession.id, false);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        sessionId: mockSession.id,
        authType: 'bearer',
      });
    });
  });

  describe('generateApiToken', () => {
    it('should generate bearer token for API use', () => {
      service.generateApiToken(mockUser, mockSession.id);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        sessionId: mockSession.id,
        authType: 'bearer',
      });
    });
  });

  describe('createSession', () => {
    const { ipAddress, userAgent } = mockSession;

    it('should create new session when none exists', async () => {
      prismaService.session.findFirst.mockResolvedValue(null);
      prismaService.session.create.mockResolvedValue(mockSession);

      const result = await service.createSession(
        mockUser.id,
        ipAddress,
        userAgent,
      );

      expect(result).toEqual(mockSession);
      expect(prismaService.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          ipAddress,
          userAgent,
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should reuse existing valid session', async () => {
      const existingSession = { ...mockSession };
      const updatedSession = {
        ...existingSession,
        lastActiveAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      };

      prismaService.session.findFirst.mockResolvedValue(existingSession);
      prismaService.session.update.mockResolvedValue(updatedSession);

      const result = await service.createSession(
        mockUser.id,
        ipAddress,
        userAgent,
      );

      expect(result).toEqual(updatedSession);
      expect(prismaService.session.update).toHaveBeenCalledWith({
        where: { id: existingSession.id },
        data: {
          lastActiveAt: expect.any(Date),
          expiresAt: expect.any(Date),
        },
      });
      expect(prismaService.session.create).not.toHaveBeenCalled();
    });
  });

  describe('handleOAuthLogin', () => {
    const { ipAddress, userAgent } = mockSession;

    beforeEach(() => {
      // Common setup for OAuth login tests
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.account.upsert.mockResolvedValue({} as any);
      prismaService.session.findFirst.mockResolvedValue(null);
      prismaService.session.create.mockResolvedValue(mockSession);
      prismaService.device.upsert.mockResolvedValue({} as any);
    });

    it('should handle complete OAuth login flow', async () => {
      const result = await service.handleOAuthLogin(
        mockOAuthData,
        ipAddress,
        userAgent,
      );

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        accessToken: 'test-jwt-token',
        sessionId: mockSession.id,
      });

      // Verify user lookup
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockOAuthData.email },
      });

      // Verify account upsert
      expect(prismaService.account.upsert).toHaveBeenCalledWith({
        where: {
          provider_providerAccountId: {
            provider: mockOAuthData.provider,
            providerAccountId: mockOAuthData.providerId,
          },
        },
        update: expect.objectContaining({
          accessToken: mockOAuthData.accessToken,
          refreshToken: mockOAuthData.refreshToken,
        }),
        create: expect.objectContaining({
          userId: mockUser.id,
          provider: mockOAuthData.provider,
          providerAccountId: mockOAuthData.providerId,
        }),
      });

      // Verify device tracking
      expect(prismaService.device.upsert).toHaveBeenCalledWith({
        where: {
          userId_deviceId: {
            userId: mockUser.id,
            deviceId: expect.any(String),
          },
        },
        update: { lastUsedAt: expect.any(Date) },
        create: {
          userId: mockUser.id,
          deviceId: expect.any(String),
          platform: expect.any(String),
          name: expect.any(String),
        },
      });

      // Verify security logging
      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith({
        level: 'info',
        userId: mockUser.id,
        event: AuthEventType.LOGIN,
        success: true,
        ipAddress,
        userAgent,
        sessionId: mockSession.id,
        details: {
          loginMethod: 'oauth',
          provider: mockOAuthData.provider,
        },
      });
    });

    it('should create new user when user does not exist', async () => {
      const newUser = { ...mockUser, id: 'new-user-456' };

      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(newUser);

      await service.handleOAuthLogin(mockOAuthData, ipAddress, userAgent);

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: mockOAuthData.email,
          name: 'Test User', // firstName + lastName
        },
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      prismaService.session.findUnique.mockResolvedValue(mockSession);
      prismaService.session.update.mockResolvedValue({
        ...mockSession,
        lastActiveAt: new Date(),
      });

      const result = await service.refreshAccessToken(
        mockUser.id,
        mockSession.id,
        mockSession.ipAddress,
        mockSession.userAgent,
      );

      expect(result).toEqual({
        user: mockUser,
        accessToken: 'test-jwt-token',
      });

      expect(prismaService.session.update).toHaveBeenCalledWith({
        where: { id: mockSession.id },
        data: { lastActiveAt: expect.any(Date) },
      });

      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith({
        level: 'info',
        userId: mockUser.id,
        event: AuthEventType.TOKEN_REFRESH,
        success: true,
        ipAddress: mockSession.ipAddress,
        userAgent: mockSession.userAgent,
        sessionId: mockSession.id,
        details: { tokenType: 'access' },
      });
    });

    it('should throw for invalid session', async () => {
      const invalidSession = { ...mockSession, isValid: false };
      prismaService.session.findUnique.mockResolvedValue(invalidSession);

      await expect(
        service.refreshAccessToken(mockUser.id, mockSession.id),
      ).rejects.toThrow('Session expired or invalid');

      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith({
        level: 'warn',
        userId: mockUser.id,
        event: AuthEventType.SESSION_EXPIRED,
        success: false,
        ipAddress: undefined,
        userAgent: undefined,
        sessionId: mockSession.id,
        details: {
          reason: 'session_invalid',
          refreshAttempt: true,
        },
      });
    });

    it('should throw for expired session', async () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      };
      prismaService.session.findUnique.mockResolvedValue(expiredSession);

      await expect(
        service.refreshAccessToken(mockUser.id, mockSession.id),
      ).rejects.toThrow('Session expired or invalid');

      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            reason: 'session_expired',
          }),
        }),
      );
    });
  });

  describe('invalidateSession', () => {
    it('should invalidate session and log event', async () => {
      prismaService.session.findUnique.mockResolvedValue({
        userId: mockUser.id,
        id: '',
        ipAddress: null,
        userAgent: null,
        token: '',
        isValid: false,
        expiresAt: new Date(),
        lastActiveAt: new Date(),
        createdAt: new Date(),
      });
      prismaService.session.update.mockResolvedValue({
        id: mockSession.id,
        isValid: false,
        userId: '',
        ipAddress: null,
        userAgent: null,
        token: '',
        expiresAt: new Date(),
        lastActiveAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.invalidateSession(mockSession.id);

      expect(result).toEqual({ success: true });
      expect(prismaService.session.update).toHaveBeenCalledWith({
        where: { id: mockSession.id },
        data: { isValid: false },
      });

      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith({
        level: 'info',
        userId: mockUser.id,
        event: AuthEventType.SESSION_TERMINATED,
        success: true,
        sessionId: mockSession.id,
        details: { terminationType: 'explicit_invalidation' },
      });
    });
  });

  describe('invalidateAllUserSessions', () => {
    it('should invalidate all sessions except current', async () => {
      const currentSessionId = 'current-session-789';
      prismaService.session.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.invalidateAllUserSessions(
        mockUser.id,
        currentSessionId,
      );

      expect(result).toEqual({ success: true });
      expect(prismaService.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          id: { not: currentSessionId },
        },
        data: { isValid: false },
      });

      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith({
        level: 'info',
        userId: mockUser.id,
        event: AuthEventType.ALL_SESSIONS_TERMINATED,
        success: true,
        details: {
          exceptSessionId: currentSessionId,
          reason: 'user_initiated',
        },
      });
    });
  });
});
