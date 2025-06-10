import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { LogsController } from './logs.controller';
import { LoggingService } from '../services/logging.service';
import { ConfigService } from '@/admin/services/config.service';
import { User } from '@/generated/prisma';
import {
  AuthEventType,
  SecurityLog,
  ApiLog,
  LogRetentionSettings,
  PaginatedResponse,
} from '@scaffold/types';
import {
  SecurityLogQueryDto,
  ApiLogQueryDto,
  LogExportQueryDto,
  LogConfigUpdateDto,
} from '../dto/logs.dto';

describe('LogsController', () => {
  let controller: LogsController;
  let loggingService: LoggingService;
  let configService: ConfigService;

  const mockUser: User = {
    id: 'admin-123',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN',
  } as User;

  const mockSecurityLogs: SecurityLog[] = [
    {
      id: 'log-1',
      timestamp: '2024-01-15T10:30:00.000Z',
      userId: 'user-1',
      event: AuthEventType.LOGIN,
      success: true,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      sessionId: 'session-1',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
      },
      details: { loginMethod: 'oauth' },
      level: 'debug',
    },
    {
      id: 'log-2',
      timestamp: '2024-01-15T10:25:00.000Z',
      userId: 'user-2',
      event: AuthEventType.FAILED_LOGIN,
      success: false,
      ipAddress: '192.168.1.2',
      userAgent: 'Chrome/120.0',
      user: {
        id: 'user-2',
        email: 'user2@example.com',
        name: 'User Two',
      },
      details: { reason: 'invalid_credentials' },
      level: 'info',
    },
  ];

  const mockApiLogs: ApiLog[] = [
    {
      timestamp: '2024-01-15T10:30:00.000Z',
      method: 'POST',
      path: '/users',
      statusCode: 201,
      responseTime: 150,
      userId: 'user-1',
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      requestId: 'req-1',
      level: 'info',
      message: 'POST /users 201',
      context: 'API',
    },
    {
      timestamp: '2024-01-15T10:28:00.000Z',
      method: 'GET',
      path: '/admin/stats',
      statusCode: 500,
      responseTime: 5000,
      userId: 'admin-1',
      ip: '192.168.1.10',
      userAgent: 'Chrome/120.0',
      requestId: 'req-2',
      level: 'error',
      message: 'GET /admin/stats 500',
      context: 'API',
    },
  ];

  const mockLogConfig: LogRetentionSettings = {
    securityLogDays: 90,
    apiLogDays: 30,
    mongoEnabled: true,
    fileEnabled: true,
  };

  const mockLoggingService = {
    getSecurityLogs: jest.fn(),
    getApiLogs: jest.fn(),
  };

  const mockConfigService = {
    getLogRetentionSettings: jest.fn(),
    updateLogRetentionSettings: jest.fn(),
    updateLoggingConfiguration: jest.fn(),
    updateCombinedLogConfiguration: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogsController],
      providers: [
        { provide: LoggingService, useValue: mockLoggingService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<LogsController>(LogsController);
    loggingService = module.get<LoggingService>(LoggingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation & Error Handling', () => {
    it('should handle service errors gracefully in getSecurityLogs', async () => {
      const query: SecurityLogQueryDto = { page: 1, limit: 50 };

      mockLoggingService.getSecurityLogs.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(controller.getSecurityLogs(query)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should transform query parameters correctly for date filtering', async () => {
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');

      const query: SecurityLogQueryDto = {
        page: 1,
        limit: 20,
        from: fromDate,
        to: toDate,
        event: AuthEventType.LOGIN,
      };

      mockLoggingService.getSecurityLogs.mockResolvedValue({
        data: [],
        pagination: { type: 'offset', total: 0, page: 1, limit: 20, pages: 0 },
      });

      await controller.getSecurityLogs(query);

      expect(loggingService.getSecurityLogs).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        userId: undefined,
        event: AuthEventType.LOGIN,
        success: undefined,
        search: undefined,
        fromDate: fromDate, // Verify date objects passed through correctly
        toDate: toDate,
      });
    });
  });

  describe('Export Response Headers', () => {
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        headersSent: false,
        removeHeader: jest.fn(),
      };
    });

    it('should set correct headers for CSV export', async () => {
      const query: LogExportQueryDto = {
        type: 'security',
        format: 'csv',
      };

      mockLoggingService.getSecurityLogs.mockResolvedValue({
        data: [],
        pagination: {
          type: 'offset',
          total: 0,
          page: 1,
          limit: 10000,
          pages: 0,
        },
      });

      await controller.exportLogs(query, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(
          /attachment; filename="security-logs-\d{4}-\d{2}-\d{2}\.csv"/,
        ),
      );
    });

    it('should clean up headers on export error before streaming starts', async () => {
      const query: LogExportQueryDto = { type: 'security', format: 'csv' };

      mockLoggingService.getSecurityLogs.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        controller.exportLogs(query, mockResponse as Response),
      ).rejects.toThrow('Database error');

      expect(mockResponse.removeHeader).toHaveBeenCalledWith('Content-Type');
      expect(mockResponse.removeHeader).toHaveBeenCalledWith(
        'Content-Disposition',
      );
    });

    it('should not clean up headers if streaming already started', async () => {
      const query: LogExportQueryDto = { type: 'security', format: 'csv' };

      // Simulate headers already sent
      (mockResponse as any).headersSent = true;

      mockLoggingService.getSecurityLogs.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw - just end the response
      await controller.exportLogs(query, mockResponse as Response);

      expect(mockResponse.removeHeader).not.toHaveBeenCalled();
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });

  describe('CSV Escaping Logic', () => {
    let mockResponse: Partial<Response>;
    const csvData: string[] = [];

    beforeEach(() => {
      csvData.length = 0;
      mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn().mockImplementation((data) => csvData.push(data)),
        end: jest.fn(),
        headersSent: false,
        removeHeader: jest.fn(),
      };
    });

    it('should properly escape CSV values with special characters', async () => {
      const logsWithSpecialChars: SecurityLog[] = [
        {
          id: 'log-1',
          timestamp: '2024-01-15T10:30:00.000Z',
          userId: 'user-1',
          event: AuthEventType.LOGIN,
          success: true,
          userAgent: 'Mozilla/5.0, "Chrome" 120.0',
          details: { note: 'Login with "quotes", commas, and\nnewlines' },
          level: 'info',
        },
      ];

      const query: LogExportQueryDto = { type: 'security', format: 'csv' };

      mockLoggingService.getSecurityLogs.mockResolvedValue({
        data: logsWithSpecialChars,
        pagination: {
          type: 'offset',
          total: 1,
          page: 1,
          limit: 10000,
          pages: 1,
        },
      });

      await controller.exportLogs(query, mockResponse as Response);

      const csvContent = csvData.join('');

      // Check that commas and quotes in userAgent are escaped
      expect(csvContent).toContain('"Mozilla/5.0, ""Chrome"" 120.0"');

      // Check that JSON details are properly escaped
      expect(csvContent).toContain('""note"":""Login with');
    });

    it('should handle null and undefined values in CSV output', async () => {
      const logsWithNulls: SecurityLog[] = [
        {
          id: 'log-1',
          timestamp: '2024-01-15T10:30:00.000Z',
          userId: 'user-1',
          event: AuthEventType.LOGIN,
          success: true,
          userAgent: null as any,
          ipAddress: undefined as any,
          details: null as any,
          level: 'info',
        },
      ];

      const query: LogExportQueryDto = { type: 'security', format: 'csv' };

      mockLoggingService.getSecurityLogs.mockResolvedValue({
        data: logsWithNulls,
        pagination: {
          type: 'offset',
          total: 1,
          page: 1,
          limit: 10000,
          pages: 1,
        },
      });

      await controller.exportLogs(query, mockResponse as Response);

      const csvContent = csvData.join('');

      // Should convert nulls/undefined to empty strings
      expect(csvContent).toContain(',,,{}'); // userAgent, ipAddress empty, then details
      expect(csvContent).toContain(',,'); // Should still have empty fields
    });
  });

  describe('Export Type Validation', () => {
    it('should reject invalid export types', async () => {
      const invalidQuery = {
        type: 'invalid',
        format: 'csv',
      } as unknown as LogExportQueryDto;

      const mockResponse = { setHeader: jest.fn() } as any;

      await expect(
        controller.exportLogs(invalidQuery, mockResponse),
      ).rejects.toThrow(
        new BadRequestException('Export type must be "security" or "api"'),
      );

      expect(mockResponse.setHeader).not.toHaveBeenCalled();
    });
  });
});
