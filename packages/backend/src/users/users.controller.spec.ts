import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { User } from '../generated/prisma';
import { RequestWithUser } from './interfaces/user-request.interface';
import { DeviceService } from '../auth/services/device.service';
import { Response } from 'express';
import { AuthService } from '@/auth/services/auth.service';

describe('UsersController', () => {
  let controller: UsersController;
  let prismaService: PrismaService;
  let deviceService: DeviceService;
  let authService: AuthService;

  // Mock user data
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
    companyName: null,
    companyLogo: null,
    phone: null,
    address: null,
    website: null,
  };

  // Mock session data
  const mockSession = {
    id: 'session-123',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
    lastActiveAt: new Date(),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  // Mock device data
  const mockDevice = {
    id: 'device-123',
    userId: 'user-123',
    deviceId: 'device-id-123',
    name: 'Test Device',
    platform: 'Android',
    lastUsedAt: new Date(),
    isTrusted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock request with JWT payload
  const mockRequest = {
    user: {
      sub: mockUser.id,
      email: mockUser.email,
      sessionId: mockSession.id,
    },
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'test-agent',
    },
  } as RequestWithUser;

  // Create mock services
  const mockPrismaService = {
    session: {
      findUnique: jest.fn().mockResolvedValue(mockSession),
    },
    device: {
      findUnique: jest.fn().mockResolvedValue(mockDevice),
    },
  };

  const mockUsersService = {};

  const mockAuthService = {
    refreshAccessToken: jest.fn().mockResolvedValue({
      user: mockUser,
      accessToken: 'new-token',
    }),
    invalidateSession: jest.fn(),
    invalidateAllUserSessions: jest.fn(),
  };

  const mockAuthCookieService = {
    setCookie: jest.fn(),
    clearCookie: jest.fn(),
    generateCsrfToken: jest.fn(),
    setCsrfCookie: jest.fn(),
  };

  const mockDeviceService = {
    getUserDevices: jest.fn().mockResolvedValue([mockDevice]),
    trustDevice: jest
      .fn()
      .mockResolvedValue({ ...mockDevice, isTrusted: true }),
    removeDevice: jest.fn().mockResolvedValue({ success: true }),
    registerDevice: jest.fn().mockResolvedValue(mockDevice),
  };

  const mockActivityLogService = {
    logActivity: jest.fn().mockResolvedValue({}),
    getRecentActivities: jest.fn().mockResolvedValue([
      {
        id: 'activity-123',
        userId: mockUser.id,
        event: AuthEventType.LOGIN,
        successful: true,
        createdAt: new Date(),
      },
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuthCookieService, useValue: mockAuthCookieService },
        { provide: DeviceService, useValue: mockDeviceService },
        { provide: ActivityLogService, useValue: mockActivityLogService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    prismaService = module.get(PrismaService);
    deviceService = module.get<DeviceService>(DeviceService);
    activityLogService = module.get<ActivityLogService>(ActivityLogService);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user with session data', async () => {
      const result = await controller.getProfile(mockRequest, mockUser);

      expect(result).toEqual({
        ...mockUser,
        session: mockSession,
      });

      expect(prismaService.session.findUnique).toHaveBeenCalledWith({
        where: { id: mockSession.id },
        select: {
          id: true,
          expiresAt: true,
          lastActiveAt: true,
          ipAddress: true,
          userAgent: true,
        },
      });

      expect(activityLogService.logActivity).toHaveBeenCalledWith(
        mockUser.id,
        AuthEventType.LOGIN,
        true,
        {
          ipAddress: mockRequest.ip,
          userAgent: mockRequest.headers['user-agent'],
        },
      );
    });

    it('should throw UnauthorizedException when no session ID in JWT', async () => {
      const requestWithoutSession = {
        user: { sub: mockUser.id, email: mockUser.email },
      } as RequestWithUser;

      await expect(
        controller.getProfile(requestWithoutSession, mockUser),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when session not found', async () => {
      mockPrismaService.session.findUnique.mockResolvedValueOnce(null);

      await expect(
        controller.getProfile(mockRequest, mockUser),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('checkSession', () => {
    it('should return valid:true when session is valid', () => {
      const result = controller.checkSession();
      expect(result).toEqual({ valid: true });
    });
  });

  describe('device management', () => {
    it('should get user devices', async () => {
      const result = await controller.getUserDevices(mockUser);

      expect(result).toEqual([mockDevice]);
      expect(deviceService.getUserDevices).toHaveBeenCalledWith(mockUser.id);
    });

    it('should trust a device', async () => {
      const result = await controller.trustDevice(mockUser, {
        deviceId: mockDevice.deviceId,
      });

      expect(result).toEqual({ ...mockDevice, isTrusted: true });
      expect(deviceService.trustDevice).toHaveBeenCalledWith(
        mockUser.id,
        mockDevice.deviceId,
      );
      expect(activityLogService.logActivity).toHaveBeenCalledWith(
        mockUser.id,
        AuthEventType.DEVICE_TRUSTED,
        true,
        { deviceId: mockDevice.deviceId },
      );
    });

    it('should remove a device', async () => {
      const result = await controller.removeDevice(
        mockUser,
        mockDevice.deviceId,
      );

      expect(result).toEqual({ success: true });
      expect(deviceService.removeDevice).toHaveBeenCalledWith(
        mockUser.id,
        mockDevice.deviceId,
      );
      expect(activityLogService.logActivity).toHaveBeenCalledWith(
        mockUser.id,
        AuthEventType.DEVICE_REMOVED,
        true,
        { deviceId: mockDevice.deviceId },
      );
    });

    it('should register a device', async () => {
      const deviceInfo = {
        deviceId: 'new-device-id',
        platform: 'iOS',
        osVersion: '15.0',
        appVersion: '1.0.0',
      };

      mockDeviceService.registerDevice.mockResolvedValueOnce({
        ...mockDevice,
        deviceId: deviceInfo.deviceId,
        platform: deviceInfo.platform,
      });

      const result = await controller.registerDevice(mockUser, deviceInfo);

      expect(result).toEqual({
        ...mockDevice,
        deviceId: deviceInfo.deviceId,
        platform: deviceInfo.platform,
      });

      expect(deviceService.registerDevice).toHaveBeenCalledWith(
        mockUser.id,
        deviceInfo,
      );
      expect(activityLogService.logActivity).toHaveBeenCalledWith(
        mockUser.id,
        AuthEventType.DEVICE_REGISTERED,
        true,
        {
          deviceId: deviceInfo.deviceId,
          platform: deviceInfo.platform,
        },
      );
    });
  });

  describe('activity log', () => {
    it('should get recent activity', async () => {
      const result = await controller.getRecentActivity(mockUser);

      expect(result).toEqual([
        {
          id: 'activity-123',
          userId: mockUser.id,
          event: AuthEventType.LOGIN,
          successful: true,
          createdAt: expect.any(Date),
        },
      ]);

      expect(activityLogService.getRecentActivities).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });
});
