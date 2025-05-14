import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';

import { AppConfig } from '../config/configuration';

import { Request, Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from './services/auth.service';
import { AuthCookieService } from './services/auth-cookie.service';

// Create mocks
const mockAuthService = {
  invalidateSession: jest.fn(),
  invalidateAllUserSessions: jest.fn(),
  verifyMobileToken: jest.fn(),
  refreshAccessToken: jest.fn(),
};

const mockPrismaService = {
  session: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockConfig = {
  auth: {
    frontendUrl: 'http://localhost:3000',
  },
};

const mockCookieService = {
  setCookie: jest.fn(),
  clearCookie: jest.fn(),
};

const mockActivityLogService = {
  logActivity: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: AppConfig, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuthCookieService, useValue: mockCookieService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('logout', () => {
    it('should invalidate session, log activity and clear cookie', async () => {
      const mockReq = {
        user: {
          id: 'user-id',
          sessionId: 'test-session-id',
        },
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'test-agent',
        },
      } as unknown as Request;

      const mockRes = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      await controller.logout(mockReq, mockRes);

      expect(mockAuthService.invalidateSession).toHaveBeenCalledWith(
        'test-session-id',
      );
      expect(mockCookieService.clearCookie).toHaveBeenCalledWith(mockRes);
      expect(mockActivityLogService.logActivity).toHaveBeenCalledWith(
        'user-id',
        'logout',
        true,
        expect.objectContaining({
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          details: expect.objectContaining({
            sessionId: 'test-session-id',
            logoutMethod: 'user_initiated',
          }),
        }),
      );
    });
  });

  // Add test for refreshToken endpoint
  describe('refreshToken', () => {
    it('should refresh token and set new cookie', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        sessionId: 'session-id',
      };

      const mockReq = {
        user: mockUser,
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'test-agent',
        },
      } as unknown as Request;

      const mockRes = {} as unknown as Response;

      const mockResult = {
        user: { id: 'user-id', email: 'test@example.com' },
        accessToken: 'new-token',
      };

      mockAuthService.refreshAccessToken.mockResolvedValue(mockResult);

      const result = await controller.refreshToken(mockReq, mockRes);

      expect(authService.refreshAccessToken).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.sessionId,
        '127.0.0.1',
        'test-agent',
      );

      expect(mockCookieService.setCookie).toHaveBeenCalledWith(
        mockRes,
        'new-token',
      );

      expect(result).toEqual({ user: mockResult.user });
    });

    it('should throw UnauthorizedException when no session ID', async () => {
      const mockReq = {
        user: { id: 'user-id' }, // Missing sessionId
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'test-agent',
        },
      } as unknown as Request;

      const mockRes = {} as unknown as Response;

      await expect(controller.refreshToken(mockReq, mockRes)).rejects.toThrow(
        'Invalid session',
      );

      expect(mockCookieService.clearCookie).toHaveBeenCalledWith(mockRes);
    });
  });
});
