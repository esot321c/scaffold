import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersController } from './users.controller';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggingService } from '@/logging/services/logging.service';
import { BadRequestException } from '@nestjs/common';
import { UserRole as PrismaUserRole } from '@/generated/prisma';
import {
  AdminUser,
  OffsetPaginatedResponse,
  UserRole as SharedUserRole,
} from '@scaffold/types';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let prismaService: PrismaService;
  let loggingService: LoggingService;

  const mockPrismaService = {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockLoggingService = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggingService, useValue: mockLoggingService },
      ],
    }).compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
    prismaService = module.get<PrismaService>(PrismaService);
    loggingService = module.get<LoggingService>(LoggingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User One',
        role: PrismaUserRole.USER,
        createdAt: new Date('2024-01-01'),
        lastLoginAt: new Date('2024-01-15'),
        _count: { sessions: 2 },
      },
      {
        id: 'user-2',
        email: 'admin@example.com',
        name: 'Admin User',
        role: PrismaUserRole.ADMIN,
        createdAt: new Date('2024-01-02'),
        lastLoginAt: null,
        _count: { sessions: 0 },
      },
    ];

    beforeEach(() => {
      mockPrismaService.user.count.mockResolvedValue(25);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
    });

    it('should return paginated users with correct format', async () => {
      const result = await controller.getAllUsers(1, 20);

      expect(result).toEqual({
        data: [
          {
            id: 'user-1',
            email: 'user1@example.com',
            name: 'User One',
            role: PrismaUserRole.USER,
            createdAt: '2024-01-01T00:00:00.000Z',
            lastLoginAt: '2024-01-15T00:00:00.000Z',
            sessionCount: 2,
          },
          {
            id: 'user-2',
            email: 'admin@example.com',
            name: 'Admin User',
            role: PrismaUserRole.ADMIN,
            createdAt: '2024-01-02T00:00:00.000Z',
            lastLoginAt: null,
            sessionCount: 0,
          },
        ],
        pagination: {
          type: 'offset',
          total: 25,
          page: 1,
          limit: 20,
          pages: 2,
        },
      });
    });

    it('should use correct database query parameters', async () => {
      await controller.getAllUsers(2, 10);

      expect(mockPrismaService.user.count).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              sessions: {
                where: {
                  isValid: true,
                  expiresAt: {
                    gt: expect.any(Date),
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: 10, // (page 2 - 1) * limit 10
        take: 10,
      });
    });

    it('should handle default pagination parameters', async () => {
      await controller.getAllUsers(1, 20);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0, // (1 - 1) * 20
          take: 20,
        }),
      );
    });

    it('should calculate pagination correctly for different scenarios', async () => {
      // Test edge case: exact page boundary
      mockPrismaService.user.count.mockResolvedValue(40);
      const result = await controller.getAllUsers(2, 20);

      expect(result.pagination).toEqual({
        type: 'offset',
        total: 40,
        page: 2,
        limit: 20,
        pages: 2,
      });
    });

    it('should handle empty results', async () => {
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await controller.getAllUsers(1, 20);

      expect(result.data).toEqual([]);
      if (result.pagination.type === 'offset') {
        expect(result.pagination.total).toBe(0);
        expect(result.pagination.pages).toBe(0);
      } else {
        fail('Expected offset pagination');
      }
    });

    it('should convert lastLoginAt dates correctly', async () => {
      const userWithLogin = {
        ...mockUsers[0],
        lastLoginAt: new Date('2024-01-15T10:30:00.000Z'),
      };
      mockPrismaService.user.findMany.mockResolvedValue([userWithLogin]);

      const result = await controller.getAllUsers(1, 20);

      expect(result.data[0].lastLoginAt).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should handle null lastLoginAt correctly', async () => {
      const userWithoutLogin = {
        ...mockUsers[0],
        lastLoginAt: null,
      };
      mockPrismaService.user.findMany.mockResolvedValue([userWithoutLogin]);

      const result = await controller.getAllUsers(1, 20);

      expect(result.data[0].lastLoginAt).toBeNull();
    });
  });

  describe('updateUserRole', () => {
    const mockUser = {
      id: 'user-1',
      role: PrismaUserRole.USER,
    };

    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: PrismaUserRole.ADMIN,
      });
    });

    it('should successfully update user role from USER to ADMIN', async () => {
      const result = await controller.updateUserRole('user-1', {
        role: SharedUserRole.ADMIN,
      });

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { role: true },
      });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: PrismaUserRole.ADMIN },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      expect(result).toEqual({
        id: 'user-1',
        email: 'user@example.com',
        role: PrismaUserRole.ADMIN,
      });
    });

    it('should successfully update user role from ADMIN to USER', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        role: PrismaUserRole.ADMIN,
      });

      await controller.updateUserRole('admin-1', { role: SharedUserRole.USER });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
        data: { role: PrismaUserRole.USER },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });
    });

    it('should throw BadRequestException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        controller.updateUserRole('nonexistent', {
          role: SharedUserRole.ADMIN,
        }),
      ).rejects.toThrow(new BadRequestException('User not found'));

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to change SUPER_ADMIN role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'super-admin-1',
        role: PrismaUserRole.SUPER_ADMIN,
      });

      await expect(
        controller.updateUserRole('super-admin-1', {
          role: SharedUserRole.USER,
        }),
      ).rejects.toThrow(
        new BadRequestException('Cannot change super admin role'),
      );

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid role', async () => {
      await expect(
        controller.updateUserRole('user-1', {
          role: SharedUserRole.SUPER_ADMIN,
        }),
      ).rejects.toThrow(new BadRequestException('Invalid role'));

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should allow setting role to USER', async () => {
      await controller.updateUserRole('user-1', { role: SharedUserRole.USER });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { role: PrismaUserRole.USER },
        }),
      );
    });

    it('should allow setting role to ADMIN', async () => {
      await controller.updateUserRole('user-1', { role: SharedUserRole.ADMIN });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { role: PrismaUserRole.ADMIN },
        }),
      );
    });
  });

  describe('type safety', () => {
    it('should return correctly typed AdminUser array', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User One',
          role: PrismaUserRole.USER,
          createdAt: new Date('2024-01-01'),
          lastLoginAt: new Date('2024-01-15'),
          _count: { sessions: 2 },
        },
      ];

      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result: OffsetPaginatedResponse<AdminUser> =
        await controller.getAllUsers(1, 20);

      // TypeScript compilation ensures this type safety
      expect(result.data[0]).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        name: expect.any(String),
        role: expect.any(String),
        createdAt: expect.any(String),
        sessionCount: expect.any(Number),
      });

      expect(result.pagination.type).toBe('offset');
    });
  });
});
