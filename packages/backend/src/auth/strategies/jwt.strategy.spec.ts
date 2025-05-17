import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '@/prisma/prisma.service';
import { AppConfig } from '@/config/configuration';
import { Request } from 'express';
import { LoggingService } from '@/logging/services/logging.service';
import { AuthEventType } from '@scaffold/types';
import { JwtService } from '@nestjs/jwt';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prismaService: PrismaService;
  let loggingService: LoggingService;
  let config: AppConfig;
  let jwtService: JwtService;

  // Setup mock services
  const mockPrismaService = {
    session: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockLoggingService = {
    logSecurityEvent: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockConfig = {
    auth: {
      jwtSecret: 'test-jwt-secret',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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
          provide: LoggingService,
          useValue: mockLoggingService,
        },
        // Add the real JwtService for token creation/validation
        JwtService,
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prismaService = module.get<PrismaService>(PrismaService);
    loggingService = module.get<LoggingService>(LoggingService);
    config = module.get<AppConfig>(AppConfig);
    jwtService = module.get<JwtService>(JwtService);

    // Configure JwtService with the test secret
    jest.spyOn(jwtService, 'verify').mockImplementation((token) => {
      // Simple mock implementation of verify
      try {
        const base64Payload = token.split('.')[1];
        const payload = JSON.parse(
          Buffer.from(base64Payload, 'base64').toString(),
        );
        return payload;
      } catch (e) {
        throw new Error('Invalid token');
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    // Create a proper mock Request object with JWT in the appropriate places
    const createMockRequest = (
      path: string,
      method: string = 'GET',
      withToken = true,
    ) => {
      const token = withToken
        ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwic2Vzc2lvbklkIjoic2Vzc2lvbjEyMyIsImlhdCI6MTUxNjIzOTAyMn0.fake_signature'
        : undefined;

      const req = {
        ip: '127.0.0.1',
        path,
        method,
        headers: {
          'user-agent': 'test-agent',
          'x-request-id': 'test-request-id',
          authorization: withToken ? `Bearer ${token}` : undefined,
        },
        get: jest.fn((header: string) => {
          const headerMap: Record<string, string | undefined> = {
            'user-agent': 'test-agent',
            authorization: withToken ? `Bearer ${token}` : undefined,
          };
          return headerMap[header.toLowerCase()] || null;
        }),
        cookies: {
          auth_token: withToken ? token : undefined,
        },
        params: {},
        query: {},
        body: {},
        signedCookies: {},
        header: jest.fn((name) => {
          return req.headers[name.toLowerCase()];
        }),
        accepts: jest.fn(),
        acceptsCharsets: jest.fn(),
        acceptsEncodings: jest.fn(),
        acceptsLanguages: jest.fn(),
        range: jest.fn(),
        protocol: 'http',
        secure: false,
        xhr: false,
        subdomains: [],
        originalUrl: path,
        baseUrl: '',
      } as unknown as Request;

      return req;
    };

    const mockPayload = {
      sub: 'user123',
      email: 'test@example.com',
      sessionId: 'session123',
      iat: 1516239022,
    };

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    it('should validate a valid session and update last active time', async () => {
      // Create a mock request for a sensitive endpoint
      const mockRequest = createMockRequest('/users/profile');

      // Mock a valid session
      const mockSession = {
        id: 'session123',
        userId: 'user123',
        isValid: true,
        expiresAt: tomorrow,
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue({
        ...mockSession,
        lastActiveAt: expect.any(Date),
      });

      // Spy on the validate method to see what's actually called
      const validateSpy = jest.spyOn(strategy, 'validate');

      const result = await strategy.validate(mockRequest, mockPayload);

      // Verify the validate method was called with the right parameters
      expect(validateSpy).toHaveBeenCalledWith(mockRequest, mockPayload);

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

      // Sensitive endpoint should be logged
      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith({
        level: 'info',
        userId: mockSession.userId,
        event: AuthEventType.TOKEN_REFRESH,
        success: true,
        ipAddress: mockRequest.ip,
        userAgent: mockRequest.headers['user-agent'],
        sessionId: mockSession.id,
        requestId: mockRequest.headers['x-request-id'] as string,
        details: {
          endpoint: mockRequest.path,
          method: mockRequest.method,
        },
      });
    });

    it('should throw UnauthorizedException when session is invalid', async () => {
      const mockRequest = createMockRequest('/api/data');

      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'session123',
        userId: 'user123',
        isValid: false, // Invalid session
        expiresAt: tomorrow,
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      });

      await expect(strategy.validate(mockRequest, mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith({
        level: 'warn',
        userId: 'user123',
        event: AuthEventType.FAILED_LOGIN,
        success: false,
        ipAddress: mockRequest.ip,
        userAgent: mockRequest.headers['user-agent'],
        requestId: mockRequest.headers['x-request-id'] as string,
        details: expect.objectContaining({
          sessionId: mockPayload.sessionId,
          reason: 'invalid_session',
        }),
      });
    });

    it('should throw UnauthorizedException when session has expired', async () => {
      const mockRequest = createMockRequest('/api/data');
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'session123',
        userId: 'user123',
        isValid: true,
        expiresAt: yesterday, // Expired session
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      });

      await expect(strategy.validate(mockRequest, mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(loggingService.logSecurityEvent).toHaveBeenCalledWith({
        level: 'warn',
        userId: 'user123',
        event: AuthEventType.SESSION_EXPIRED,
        success: false,
        ipAddress: mockRequest.ip,
        userAgent: mockRequest.headers['user-agent'],
        requestId: mockRequest.headers['x-request-id'] as string,
        details: expect.objectContaining({
          sessionId: mockPayload.sessionId,
          expiredAt: yesterday,
        }),
      });
    });

    it('should throw UnauthorizedException when session is not found', async () => {
      const mockRequest = createMockRequest('/api/data');
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(mockRequest, mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );

      // No security log should be attempted since we don't have a userId
      expect(loggingService.logSecurityEvent).not.toHaveBeenCalled();
    });

    it('should skip logging for non-sensitive endpoints', async () => {
      // Mock a valid session
      const mockSession = {
        id: 'session123',
        userId: 'user123',
        isValid: true,
        expiresAt: tomorrow,
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue({
        ...mockSession,
        lastActiveAt: expect.any(Date),
      });

      // Use a non-sensitive endpoint
      const nonSensitiveRequest = createMockRequest('/api/public/data');

      await strategy.validate(nonSensitiveRequest, mockPayload);

      // Validate session was found and updated
      expect(prismaService.session.findUnique).toHaveBeenCalled();
      expect(prismaService.session.update).toHaveBeenCalled();

      // But no security log for non-sensitive endpoint
      expect(loggingService.logSecurityEvent).not.toHaveBeenCalled();
    });
  });
});
