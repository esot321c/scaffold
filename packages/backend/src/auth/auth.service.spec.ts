import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuthCookieService } from './services/auth-cookie.service';
import { ActivityLogService } from './services/activity-log.service';

describe('AuthService', () => {
  let service: AuthService;
  let activityLogService: ActivityLogService;

  // Mock objects for all dependencies
  const mockPrismaService = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    account: { upsert: jest.fn() },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('test-jwt-token'),
    verify: jest.fn(),
  };

  const mockAuthCookieService = {
    setCookie: jest.fn(),
    clearCookie: jest.fn(),
    generateCsrfToken: jest.fn(),
    setCsrfCookie: jest.fn(),
  };

  const mockActivityLogService = {
    logActivity: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        // Provide mocks for all dependencies
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AuthCookieService, useValue: mockAuthCookieService },
        { provide: ActivityLogService, useValue: mockActivityLogService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    activityLogService = module.get<ActivityLogService>(ActivityLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Simple test for generateJwtToken
  it('should generate a JWT token', () => {
    const user = { id: 'user-id', email: 'test@example.com' };
    const sessionId = 'session-id';

    const token = service.generateJwtToken(user, sessionId);

    expect(token).toBe('test-jwt-token');
    expect(mockJwtService.sign).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      sessionId,
    });
  });

  // Test for createSession
  it('should create a session', async () => {
    const userId = 'user-id';
    const ipAddress = '127.0.0.1';
    const userAgent = 'test-agent';

    const mockSession = {
      id: 'session-id',
      token: 'session-token',
      userId,
      expiresAt: expect.any(Date),
    };

    mockPrismaService.session.create.mockResolvedValue(mockSession);

    const result = await service.createSession(userId, ipAddress, userAgent);

    expect(result).toEqual(mockSession);
    expect(mockPrismaService.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        ipAddress,
        userAgent,
        token: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
  });

  // New test for handleOAuthLogin
  it('should handle OAuth login and log activity', async () => {
    const userData = {
      provider: 'google',
      providerId: 'google-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    };
    const ipAddress = '127.0.0.1';
    const userAgent = 'test-agent';

    const mockUser = {
      id: 'user-id',
      email: userData.email,
      name: 'Test User',
    };

    const mockSession = {
      id: 'session-id',
      token: 'session-token',
      expiresAt: new Date(),
    };

    mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaService.account.upsert.mockResolvedValue({});
    mockPrismaService.session.create.mockResolvedValue(mockSession);

    const result = await service.handleOAuthLogin(
      userData,
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

    // Verify activity logging
    expect(activityLogService.logActivity).toHaveBeenCalledWith(
      mockUser.id,
      'login',
      true,
      expect.objectContaining({
        ipAddress,
        userAgent,
      }),
    );
  });

  // New test for refreshAccessToken
  it('should refresh access token and log activity', async () => {
    const userId = 'user-id';
    const sessionId = 'session-id';
    const ipAddress = '127.0.0.1';
    const userAgent = 'test-agent';

    const mockSession = {
      id: sessionId,
      userId,
      isValid: true,
      expiresAt: new Date(Date.now() + 86400000), // Tomorrow
      user: {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
      },
    };

    mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
    mockPrismaService.session.update.mockResolvedValue({
      ...mockSession,
      lastActiveAt: new Date(),
    });

    const result = await service.refreshAccessToken(
      userId,
      sessionId,
      ipAddress,
      userAgent,
    );

    expect(result).toEqual({
      user: mockSession.user,
      accessToken: 'test-jwt-token',
    });

    // Verify token was refreshed
    expect(mockJwtService.sign).toHaveBeenCalledWith({
      sub: userId,
      email: mockSession.user.email,
      sessionId,
    });

    // Verify activity logging
    expect(activityLogService.logActivity).toHaveBeenCalledWith(
      userId,
      'token_refresh',
      true,
      expect.objectContaining({
        ipAddress,
        userAgent,
        details: expect.objectContaining({
          sessionId,
          tokenType: 'access',
        }),
      }),
    );
  });

  // Test for session invalidation
  it('should invalidate a session', async () => {
    const sessionId = 'session-id';

    mockPrismaService.session.update.mockResolvedValue({
      id: sessionId,
      isValid: false,
    });

    await service.invalidateSession(sessionId);

    expect(mockPrismaService.session.update).toHaveBeenCalledWith({
      where: { id: sessionId },
      data: { isValid: false },
    });
  });
});
