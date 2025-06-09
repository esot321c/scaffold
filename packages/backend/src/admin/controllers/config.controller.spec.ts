import { Test, TestingModule } from '@nestjs/testing';
import { ConfigController } from './config.controller';
import { ConfigService } from '../services/config.service';
import { User } from '@/generated/prisma';
import { BadRequestException } from '@nestjs/common';
import { LogRetentionSettings } from '@scaffold/types';
import {
  UpdateLoggingConfigDto,
  UpdateLogRetentionDto,
} from '../dto/config.dto';

describe('ConfigController', () => {
  let controller: ConfigController;
  let configService: ConfigService;

  const mockUser: User = {
    id: 'admin-123',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN',
  } as User;

  const mockConfigService = {
    getLogRetentionSettings: jest.fn(),
    updateLogRetentionSettings: jest.fn(),
    updateLoggingConfiguration: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<ConfigController>(ConfigController);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLogRetentionSettings', () => {
    it('should return current log retention settings', async () => {
      const mockSettings: LogRetentionSettings = {
        securityLogDays: 90,
        apiLogDays: 30,
        mongoEnabled: true,
        fileEnabled: true,
      };

      mockConfigService.getLogRetentionSettings.mockResolvedValue(mockSettings);

      const result = await controller.getLogRetentionSettings();

      expect(result).toEqual(mockSettings);
      expect(configService.getLogRetentionSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateLogRetentionSettings', () => {
    it('should update retention settings and return updated config', async () => {
      const updateDto: UpdateLogRetentionDto = {
        securityLogDays: 120,
        apiLogDays: 45,
      };

      const updatedSettings: LogRetentionSettings = {
        securityLogDays: 120,
        apiLogDays: 45,
        mongoEnabled: true,
        fileEnabled: true,
      };

      mockConfigService.updateLogRetentionSettings.mockResolvedValue(
        updatedSettings,
      );

      const result = await controller.updateLogRetentionSettings(
        updateDto,
        mockUser,
      );

      expect(result).toEqual(updatedSettings);
      expect(configService.updateLogRetentionSettings).toHaveBeenCalledWith(
        updateDto,
        mockUser,
      );
    });
  });

  describe('updateLoggingConfiguration', () => {
    it('should update logging config and return updated settings', async () => {
      const updateDto: UpdateLoggingConfigDto = {
        mongoEnabled: false,
        fileEnabled: true,
      };

      const updatedSettings: LogRetentionSettings = {
        securityLogDays: 90,
        apiLogDays: 30,
        mongoEnabled: false,
        fileEnabled: true,
      };

      mockConfigService.updateLoggingConfiguration.mockResolvedValue(
        updatedSettings,
      );

      const result = await controller.updateLoggingConfiguration(
        updateDto,
        mockUser,
      );

      expect(result).toEqual(updatedSettings);
      expect(configService.updateLoggingConfiguration).toHaveBeenCalledWith(
        updateDto,
        mockUser,
      );
    });

    it('should propagate service errors', async () => {
      const invalidDto: UpdateLoggingConfigDto = {
        mongoEnabled: false,
        fileEnabled: false,
      };

      mockConfigService.updateLoggingConfiguration.mockRejectedValue(
        new BadRequestException(
          'At least one logging method (MongoDB or file) must be enabled',
        ),
      );

      await expect(
        controller.updateLoggingConfiguration(invalidDto, mockUser),
      ).rejects.toThrow(BadRequestException);

      expect(configService.updateLoggingConfiguration).toHaveBeenCalledWith(
        invalidDto,
        mockUser,
      );
    });
  });
});
