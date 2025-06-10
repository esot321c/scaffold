import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { AppConfig } from '@/config/configuration';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthCookieService } from '../services/auth-cookie.service';
import { LoggingService } from '@/logging/services/logging.service';
import { OAuthUser } from '../interfaces/oauth-user.interface';
import { AuthEventType } from '@scaffold/types';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let prismaService: PrismaService;
  let cookieService: AuthCookieService;
  let loggingService: LoggingService;
  let config: AppConfig;

  const mockOAuthUser: OAuthUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    accessToken: 'access-token-123',
    sessionId: 'session-123',
  };

  const mockSession = {
    id: 'session-123',
    createdAt: new Date('2024-01-15T10:00:00.000Z'),
    expiresAt: new Date('2024-02-15T10:00:00.000Z'),
    lastActiveAt: new Date('2024-01-15T10:30:00.000Z'),
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
  };

  const mockAuthService = {
    invalidateSession: jest.fn(),
    invalidateAllUserSessions: jest.fn(),
    refreshAccessToken: jest.fn(),
  };

  const mockPrismaService = {
    session: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockCookieService = {
    setCookie: jest.fn(),
    clearCookie: jest.fn(),
    setCsrfCookie: jest.fn(),
  };

  const mockLoggingService = {
    logSecurityEvent: jest.fn(),
  };

  const mockConfig = {
    auth: {
      frontendUrl: 'http://localhost:3000',
    },
  };

  const createMockRequest = (
    user: Partial<OAuthUser> = mockOAuthUser,
  ): Partial<Request> => ({
    user: user as OAuthUser,
    ip: '192.168.1.1',
    headers: {
      'user-agent': 'test-agent',
      'x-request-id': 'test-request-id',
    },
  });

  const createMockResponse = (): Partial<Response> => ({
    redirect: jest.fn(),
    setHeader: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: AppConfig, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuthCookieService, useValue: mockCookieService },
        { provide: LoggingService, useValue: mockLoggingService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    cookieService = module.get<AuthCookieService>(AuthCookieService);
    loggingService = module.get<LoggingService>(LoggingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('googleLogin', () => {
    it('should initiate Google OAuth flow', () => {
      // This is handled by the AuthGuard, so we just verify the method exists
      expect(controller.googleLogin).toBeDefined();
      expect(typeof controller.googleLogin).toBe('function');
    });
  });

  describe('googleCallback', () => {
    it('should handle OAuth callback and redirect with cookies', () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse();

      controller.googleCallback(mockReq as Request, mockRes as Response);

      expect(cookieService.setCookie).toHaveBeenCalledWith(
        mockRes,
        mockOAuthUser.accessToken,
      );
      expect(cookieService.setCsrfCookie).toHaveBeenCalledWith(mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/success',
      );
    });
  });

  describe('logout', () => {
    it('should logout user and clear cookies', async () => {
      const mockReq = createMockRequest();
      const mockRes = createMockResponse();

      await controller.logout(mockReq as Request, mockRes as Response);

      expect(authService.invalidateSession).toHaveBeenCalledWith('session-123');
      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith({
        level: 'info',
        userId: 'user-123',
        event: AuthEventType.LOGOUT,
        success: true,
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
        sessionId: 'session-123',
        requestId: 'test-request-id',
        details: {
          logoutMethod: 'user_initiated',
        },
      });
      expect(cookieService.clearCookie).toHaveBeenCalledWith(mockRes);
    });

    it('should clear cookies even when user has no sessionId', async () => {
      const userWithoutSession = { ...mockOAuthUser, sessionId: undefined };
      const mockReq = createMockRequest(userWithoutSession);
      const mockRes = createMockResponse();

      await controller.logout(mockReq as Request, mockRes as Response);

      expect(authService.invalidateSession).not.toHaveBeenCalled();
      expect(loggingService.logSecurityEvent).not.toHaveBeenCalled();
      expect(cookieService.clearCookie).toHaveBeenCalledWith(mockRes);
    });
  });

  describe('getSessions', () => {
    it('should return user sessions with proper formatting', async () => {
      const mockSessions = [mockSession, { ...mockSession, id: 'session-456' }];
      mockPrismaService.session.findMany.mockResolvedValue(mockSessions);

      const mockReq = createMockRequest();
      const result = await controller.getSessions(mockReq as Request);

      expect(prismaService.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isValid: true,
        },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          lastActiveAt: true,
          ipAddress: true,
          userAgent: true,
        },
        orderBy: {
          lastActiveAt: 'desc',
        },
      });

      expect(result).toEqual([
        {
          id: 'session-123',
          createdAt: '2024-01-15T10:00:00.000Z',
          expiresAt: '2024-02-15T10:00:00.000Z',
          lastActiveAt: '2024-01-15T10:30:00.000Z',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        {
          id: 'session-456',
          createdAt: '2024-01-15T10:00:00.000Z',
          expiresAt: '2024-02-15T10:00:00.000Z',
          lastActiveAt: '2024-01-15T10:30:00.000Z',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      ]);
    });

    it('should return empty array when no sessions found', async () => {
      mockPrismaService.session.findMany.mockResolvedValue([]);

      const mockReq = createMockRequest();
      const result = await controller.getSessions(mockReq as Request);

      expect(result).toEqual([]);
    });
  });

  describe('invalidateSession', () => {
    it('should invalidate session when user owns it', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue({
        userId: 'user-123',
      });

      const mockReq = createMockRequest();
      await controller.invalidateSession('session-123', mockReq as Request);

      expect(prismaService.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        select: { userId: true },
      });
      expect(authService.invalidateSession).toHaveBeenCalledWith('session-123');
      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith({
        level: 'info',
        userId: 'user-123',
        event: AuthEventType.SESSION_EXPIRED,
        success: true,
        sessionId: 'session-123',
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
        requestId: 'test-request-id',
        details: {
          terminationType: 'user_terminated',
        },
      });
    });

    it('should throw UnauthorizedException when session not found', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      const mockReq = createMockRequest();

      await expect(
        controller.invalidateSession('session-123', mockReq as Request),
      ).rejects.toThrow(
        new UnauthorizedException('Session not found or not owned by user'),
      );

      expect(authService.invalidateSession).not.toHaveBeenCalled();
      expect(loggingService.logSecurityEvent).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user does not own session', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue({
        userId: 'other-user',
      });

      const mockReq = createMockRequest();

      await expect(
        controller.invalidateSession('session-123', mockReq as Request),
      ).rejects.toThrow(
        new UnauthorizedException('Session not found or not owned by user'),
      );

      expect(authService.invalidateSession).not.toHaveBeenCalled();
    });
  });

  describe('invalidateAllSessions', () => {
    it('should invalidate all user sessions and log activity', async () => {
      const mockReq = createMockRequest();

      await controller.invalidateAllSessions(mockReq as Request);

      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith({
        level: 'info',
        userId: 'user-123',
        event: AuthEventType.SESSION_EXPIRED,
        success: true,
        sessionId: 'session-123',
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
        requestId: 'test-request-id',
        details: {
          terminationType: 'user_terminated_all',
        },
      });
      expect(authService.invalidateAllUserSessions).toHaveBeenCalledWith(
        'user-123',
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token and set new cookie', async () => {
      const mockRefreshResult = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
        },
        accessToken: 'new-access-token',
      };

      mockAuthService.refreshAccessToken.mockResolvedValue(mockRefreshResult);

      const mockReq = createMockRequest();
      const mockRes = createMockResponse();

      await controller.refreshToken(mockReq as Request, mockRes as Response);

      expect(authService.refreshAccessToken).toHaveBeenCalledWith(
        'user-123',
        'session-123',
        '192.168.1.1',
        'test-agent',
      );
      expect(cookieService.setCookie).toHaveBeenCalledWith(
        mockRes,
        'new-access-token',
      );
    });

    it('should throw UnauthorizedException when user has no sessionId', async () => {
      const userWithoutSession = { ...mockOAuthUser, sessionId: undefined };
      const mockReq = createMockRequest(userWithoutSession);
      const mockRes = createMockResponse();

      await expect(
        controller.refreshToken(mockReq as Request, mockRes as Response),
      ).rejects.toThrow(new UnauthorizedException('Invalid session'));

      expect(cookieService.clearCookie).toHaveBeenCalledWith(mockRes);
      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user has no id', async () => {
      const userWithoutId = { ...mockOAuthUser, id: undefined };
      const mockReq = createMockRequest(userWithoutId);
      const mockRes = createMockResponse();

      await expect(
        controller.refreshToken(mockReq as Request, mockRes as Response),
      ).rejects.toThrow(new UnauthorizedException('Invalid session'));

      expect(cookieService.clearCookie).toHaveBeenCalledWith(mockRes);
    });
  });

  describe('getCsrfToken', () => {
    it('should generate and return CSRF token', () => {
      mockCookieService.setCsrfCookie.mockReturnValue('csrf-token-123');

      const mockRes = createMockResponse();
      const result = controller.getCsrfToken(mockRes as Response);

      expect(cookieService.setCsrfCookie).toHaveBeenCalledWith(mockRes);
      expect(result).toBe('csrf-token-123');
    });
  });
});
