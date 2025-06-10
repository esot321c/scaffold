import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from './config.service';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggingService } from '@/logging/services/logging.service';
import { User } from '@/generated/prisma';
import {
  CONFIG_DEFAULTS,
  CONFIG_KEYS,
  LogRetentionSettings,
} from '@scaffold/types';
import {
  UpdateLoggingConfigDto,
  UpdateLogRetentionDto,
} from '../dto/config.dto';

describe('ConfigService', () => {
  let service: ConfigService;
  let prismaService: PrismaService;
  let loggingService: LoggingService;

  const mockUser: User = {
    id: 'admin-123',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN',
  } as User;

  const mockPrismaService = {
    systemConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const mockLoggingService = {
    reconfigureTtlIndexes: jest.fn(),
    reloadConfiguration: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggingService, useValue: mockLoggingService },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
    prismaService = module.get<PrismaService>(PrismaService);
    loggingService = module.get<LoggingService>(LoggingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLogRetentionSettings', () => {
    it('should return settings from database when configs exist', async () => {
      mockPrismaService.systemConfig.findUnique
        .mockResolvedValueOnce({ value: '120' }) // security logs
        .mockResolvedValueOnce({ value: '45' }) // api logs
        .mockResolvedValueOnce({ value: 'true' }) // mongo enabled
        .mockResolvedValueOnce({ value: 'false' }); // file enabled

      const result = await service.getLogRetentionSettings();

      expect(result).toEqual({
        securityLogDays: 120,
        apiLogDays: 45,
        mongoEnabled: true,
        fileEnabled: false,
      });

      expect(prismaService.systemConfig.findUnique).toHaveBeenCalledTimes(4);
    });

    it('should return defaults when configs do not exist', async () => {
      mockPrismaService.systemConfig.findUnique.mockResolvedValue(null);

      const result = await service.getLogRetentionSettings();

      expect(result).toEqual({
        securityLogDays: CONFIG_DEFAULTS.SECURITY_LOG_DAYS,
        apiLogDays: CONFIG_DEFAULTS.API_LOG_DAYS,
        mongoEnabled: false, // null !== 'true'
        fileEnabled: true, // null !== 'false'
      });
    });

    it('should handle partial configs with proper defaults', async () => {
      mockPrismaService.systemConfig.findUnique
        .mockResolvedValueOnce({ value: '60' }) // security logs exists
        .mockResolvedValueOnce(null) // api logs missing
        .mockResolvedValueOnce({ value: 'true' }) // mongo enabled
        .mockResolvedValueOnce(null); // file enabled missing

      const result = await service.getLogRetentionSettings();

      expect(result).toEqual({
        securityLogDays: 60,
        apiLogDays: CONFIG_DEFAULTS.API_LOG_DAYS,
        mongoEnabled: true,
        fileEnabled: true, // defaults to true when missing
      });
    });
  });

  describe('updateLogRetentionSettings', () => {
    it('should update retention settings and reconfigure TTL indexes', async () => {
      const dto: UpdateLogRetentionDto = {
        securityLogDays: 180,
        apiLogDays: 60,
      };

      const expectedResult: LogRetentionSettings = {
        securityLogDays: 180,
        apiLogDays: 60,
        mongoEnabled: true,
        fileEnabled: true,
      };

      // Mock the final getLogRetentionSettings call
      jest
        .spyOn(service, 'getLogRetentionSettings')
        .mockResolvedValue(expectedResult);

      const result = await service.updateLogRetentionSettings(dto, mockUser);

      expect(result).toEqual(expectedResult);
      expect(prismaService.systemConfig.upsert).toHaveBeenCalledTimes(2);
      expect(prismaService.systemConfig.upsert).toHaveBeenNthCalledWith(1, {
        where: { key: CONFIG_KEYS.AUTH_LOG_RETENTION },
        update: { value: '180', updatedBy: mockUser.id },
        create: {
          key: CONFIG_KEYS.AUTH_LOG_RETENTION,
          value: '180',
          description: 'Number of days to retain security activity logs',
          updatedBy: mockUser.id,
        },
      });
      expect(loggingService.reconfigureTtlIndexes).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateLoggingConfiguration', () => {
    it('should update logging config successfully', async () => {
      const dto: UpdateLoggingConfigDto = {
        mongoEnabled: false,
        fileEnabled: true,
      };

      const expectedResult: LogRetentionSettings = {
        securityLogDays: 90,
        apiLogDays: 30,
        mongoEnabled: false,
        fileEnabled: true,
      };

      jest
        .spyOn(service, 'getLogRetentionSettings')
        .mockResolvedValue(expectedResult);

      const result = await service.updateLoggingConfiguration(dto, mockUser);

      expect(result).toEqual(expectedResult);
      expect(prismaService.systemConfig.upsert).toHaveBeenCalledTimes(2);
      expect(loggingService.reloadConfiguration).toHaveBeenCalledTimes(1);
    });

    it('should throw error when both logging methods are disabled', async () => {
      const dto: UpdateLoggingConfigDto = {
        mongoEnabled: false,
        fileEnabled: false,
      };

      await expect(
        service.updateLoggingConfiguration(dto, mockUser),
      ).rejects.toThrow(
        new BadRequestException(
          'At least one logging method (MongoDB or file) must be enabled',
        ),
      );

      expect(prismaService.systemConfig.upsert).not.toHaveBeenCalled();
      expect(loggingService.reloadConfiguration).not.toHaveBeenCalled();
    });
  });

  describe('updateCombinedLogConfiguration', () => {
    beforeEach(() => {
      // Mock current config for combined updates
      jest.spyOn(service, 'getLogRetentionSettings').mockResolvedValue({
        securityLogDays: 90,
        apiLogDays: 30,
        mongoEnabled: true,
        fileEnabled: true,
      });
    });

    it('should update only retention settings when provided', async () => {
      const dto = { securityLogDays: 120, apiLogDays: 45 };

      const updateRetentionSpy = jest
        .spyOn(service, 'updateLogRetentionSettings')
        .mockResolvedValue({
          securityLogDays: 120,
          apiLogDays: 45,
          mongoEnabled: true,
          fileEnabled: true,
        });

      await service.updateCombinedLogConfiguration(dto, mockUser);

      expect(updateRetentionSpy).toHaveBeenCalledWith(
        { securityLogDays: 120, apiLogDays: 45 },
        mockUser,
      );
    });

    it('should update only logging methods when provided', async () => {
      const dto = { mongoEnabled: false, fileEnabled: true };

      const updateConfigSpy = jest
        .spyOn(service, 'updateLoggingConfiguration')
        .mockResolvedValue({
          securityLogDays: 90,
          apiLogDays: 30,
          mongoEnabled: false,
          fileEnabled: true,
        });

      await service.updateCombinedLogConfiguration(dto, mockUser);

      expect(updateConfigSpy).toHaveBeenCalledWith(
        { mongoEnabled: false, fileEnabled: true },
        mockUser,
      );
    });

    it('should throw error when trying to disable both logging methods', async () => {
      const dto = { mongoEnabled: false, fileEnabled: false };

      await expect(
        service.updateCombinedLogConfiguration(dto, mockUser),
      ).rejects.toThrow(
        new BadRequestException(
          'At least one logging method (MongoDB or file) must be enabled',
        ),
      );
    });

    it('should allow partial updates without violating business rules', async () => {
      // Current config has both enabled, only updating mongo to false should work
      const dto = { mongoEnabled: false }; // fileEnabled remains true from current config

      const updateConfigSpy = jest
        .spyOn(service, 'updateLoggingConfiguration')
        .mockResolvedValue({
          securityLogDays: 90,
          apiLogDays: 30,
          mongoEnabled: false,
          fileEnabled: true,
        });

      await service.updateCombinedLogConfiguration(dto, mockUser);

      expect(updateConfigSpy).toHaveBeenCalledWith(
        { mongoEnabled: false, fileEnabled: true }, // Should merge with current config
        mockUser,
      );
    });
  });
});
