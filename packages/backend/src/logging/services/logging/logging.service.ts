import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import {
  ApiLog,
  SecurityLog,
  SecurityLogFilter,
  ApiLogFilter,
} from '@/logging/interfaces/log.types';
import { PrismaService } from '@/prisma/prisma.service';
import { PaginatedResponse } from '@scaffold/types';
import { AuthEventType } from '@/logging/interfaces/event-types';

@Injectable()
export class LoggingService implements OnModuleInit {
  private readonly logger: winston.Logger;
  private readonly mongoEnabled: boolean;
  private readonly fileEnabled: boolean;
  private apiLogRetentionDays: number;
  private securityLogRetentionDays: number;

  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
    @InjectModel('ApiLog') private apiLogModel: Model<ApiLog>,
    @InjectModel('SecurityLog') private securityLogModel: Model<SecurityLog>,
  ) {
    // Determine which transports to enable
    this.mongoEnabled =
      this.configService.get<boolean>('LOGGING_MONGO_ENABLED') ?? true;
    this.fileEnabled =
      this.configService.get<boolean>('LOGGING_FILE_ENABLED') ?? true;

    // Default retention days from environment
    const defaultRetention =
      this.configService.get<number>('LOGGING_DEFAULT_RETENTION_DAYS') ?? 30;
    this.apiLogRetentionDays = defaultRetention;
    this.securityLogRetentionDays = defaultRetention;

    // Create Winston logger with transports
    this.logger = winston.createLogger({
      level: this.configService.get<string>('LOG_LEVEL') ?? 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      defaultMeta: { service: 'api' },
      transports: this.createTransports(),
      exitOnError: false,
    });
  }

  /**
   * Initialize logging system
   */
  async onModuleInit(): Promise<void> {
    try {
      // Get retention config from database
      const apiLogConfig = await this.prismaService.systemConfig.findUnique({
        where: { key: 'api_log_retention_days' },
      });

      const securityLogConfig =
        await this.prismaService.systemConfig.findUnique({
          where: { key: 'auth_log_retention_days' },
        });

      // Set retention periods from config or use default
      if (apiLogConfig) {
        this.apiLogRetentionDays = parseInt(apiLogConfig.value, 10);
      }

      if (securityLogConfig) {
        this.securityLogRetentionDays = parseInt(securityLogConfig.value, 10);
      }

      // Create TTL indexes with the configured retention periods
      if (this.mongoEnabled) {
        await this.setupTtlIndexes();
      }

      // Log startup message
      this.logger.info('Logging system initialized', {
        context: 'LoggingService',
        mongoEnabled: this.mongoEnabled,
        fileEnabled: this.fileEnabled,
        apiLogRetentionDays: this.apiLogRetentionDays,
        securityLogRetentionDays: this.securityLogRetentionDays,
      });
    } catch (error) {
      console.error('Failed to initialize logging system:', error);
    }
  }

  /**
   * Create Winston transports based on configuration
   */
  private createTransports(): winston.transport[] {
    const transports: winston.transport[] = [];

    // Always add console transport in development
    if (process.env.NODE_ENV !== 'production') {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      );
    }

    // Add file transport if enabled
    if (this.fileEnabled) {
      const fileTransport = new winston.transports.DailyRotateFile({
        dirname: this.configService.get<string>('LOG_DIR') ?? 'logs',
        filename: 'application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      });

      transports.push(fileTransport);
    }

    return transports;
  }

  /**
   * Set up TTL indexes based on retention configuration
   */
  private async setupTtlIndexes(): Promise<void> {
    try {
      // Calculate TTL in seconds
      const apiLogTtl = this.apiLogRetentionDays * 24 * 60 * 60;
      const securityLogTtl = this.securityLogRetentionDays * 24 * 60 * 60;

      // Ensure index exists with correct TTL
      const apiCollection = this.apiLogModel.collection;
      const securityCollection = this.securityLogModel.collection;

      // Drop existing TTL indexes if they exist
      try {
        await apiCollection.dropIndex('timestamp_1');
        await securityCollection.dropIndex('timestamp_1');
      } catch (error) {
        // Index might not exist, that's OK
      }

      // Create new TTL indexes
      await apiCollection.createIndex(
        { timestamp: 1 },
        {
          expireAfterSeconds: apiLogTtl,
          name: 'timestamp_1',
          background: true,
        },
      );

      await securityCollection.createIndex(
        { timestamp: 1 },
        {
          expireAfterSeconds: securityLogTtl,
          name: 'timestamp_1',
          background: true,
        },
      );

      this.logger.info('TTL indexes created successfully', {
        context: 'LoggingService',
        apiLogTtl,
        securityLogTtl,
      });
    } catch (error) {
      this.logger.error('Failed to setup TTL indexes', {
        context: 'LoggingService',
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error,
        mongoEnabled: this.mongoEnabled,
      });

      // TODO: add a fallback mechanism or retry logic here
      if (process.env.NODE_ENV === 'production') {
        // Maybe set up a health check that can alert ops if TTL indexes aren't working
        // This could prevent the database from growing indefinitely
      }
    }
  }

  /**
   * Log API request/response
   */
  async logApiCall(data: Omit<ApiLog, 'timestamp'>): Promise<void> {
    try {
      this.logger.info(data.message, {
        ...data,
        type: 'api_log',
      });

      // Store in MongoDB if enabled
      if (this.mongoEnabled) {
        await this.apiLogModel.create({
          ...data,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      // Fail silently but log to console in dev
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to log API call:', error);
      }
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(data: Omit<SecurityLog, 'timestamp'>): Promise<void> {
    try {
      const level = data.success ? 'info' : 'warn';

      this.logger.log(level, `Security event: ${data.event}`, {
        ...data,
        type: 'security_log',
      });

      // Store in MongoDB if enabled
      if (this.mongoEnabled) {
        await this.securityLogModel.create({
          ...data,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      // Fail silently but log to console in dev
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to log security event:', error);
      }
    }
  }

  /**
   * Get security logs with pagination and filtering
   */
  async getSecurityLogs(
    filter: SecurityLogFilter,
  ): Promise<PaginatedResponse<SecurityLog>> {
    const {
      page = 1,
      limit = 50,
      userId,
      userIds,
      event,
      success,
      search,
      fromDate,
      toDate,
      includeDetails = true,
    } = filter;

    const skip = (page - 1) * limit;

    // Build filter criteria
    const query: Record<string, any> = {};

    if (userId) {
      query.userId = userId;
    }

    if (userIds && userIds.length > 0) {
      query.userId = { $in: userIds };
    }

    if (event) {
      query.event = event;
    }

    if (success !== undefined) {
      query.success = success;
    }

    // Add date range filtering
    if (fromDate || toDate) {
      query.timestamp = {};

      if (fromDate) {
        query.timestamp.$gte = fromDate;
      }

      if (toDate) {
        query.timestamp.$lte = toDate;
      }
    }

    if (search) {
      // Search for IP address, user agent, or in details
      query.$or = [
        { ipAddress: { $regex: search, $options: 'i' } },
        { userAgent: { $regex: search, $options: 'i' } },
        { 'details.sessionId': { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count for pagination
    const total = await this.securityLogModel.countDocuments(query);

    // Define projection for better performance when details aren't needed
    const projection = includeDetails ? {} : { details: 0 };

    // Get logs with pagination
    const logs = await this.securityLogModel
      .find(query, projection)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return {
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get API logs with pagination and filtering
   */
  async getApiLogs(filter: ApiLogFilter): Promise<PaginatedResponse<ApiLog>> {
    const {
      page = 1,
      limit = 50,
      path,
      method,
      statusCode,
      userId,
      search,
    } = filter;
    const skip = (page - 1) * limit;

    // Build filter criteria
    const query: Record<string, any> = {};

    if (path) {
      query.path = { $regex: path, $options: 'i' };
    }

    if (method) {
      query.method = method;
    }

    if (statusCode) {
      query.statusCode = statusCode;
    }

    if (userId) {
      query.userId = userId;
    }

    if (search) {
      // Search in path, IP, or user agent
      query.$or = [
        { path: { $regex: search, $options: 'i' } },
        { ip: { $regex: search, $options: 'i' } },
        { userAgent: { $regex: search, $options: 'i' } },
      ];
    }

    // Get total count for pagination
    const total = await this.apiLogModel.countDocuments(query);

    // Get logs with pagination
    const logs = await this.apiLogModel
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return {
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get the last login date for each user in a list
   * This uses MongoDB aggregation for optimal performance
   */
  async getLastLoginByUsers(userIds: string[]): Promise<Map<string, Date>> {
    if (!userIds.length) return new Map();

    // Use aggregation to efficiently get the last login for each user
    const results = await this.securityLogModel
      .aggregate([
        {
          $match: {
            userId: { $in: userIds },
            event: AuthEventType.LOGIN,
            success: true,
          },
        },
        {
          $sort: { timestamp: -1 },
        },
        {
          $group: {
            _id: '$userId',
            lastLogin: { $first: '$timestamp' },
          },
        },
      ])
      .exec();

    // Create the map
    const lastLoginMap = new Map<string, Date>();
    results.forEach((result) => {
      lastLoginMap.set(result._id, result.lastLogin);
    });

    return lastLoginMap;
  }

  /**
   * Log general application event
   */
  log(
    level: string,
    message: string,
    context: string,
    metadata?: Record<string, any>,
  ): void {
    this.logger.log(level, message, {
      context,
      ...metadata,
      type: 'app_log',
    });
  }

  /**
   * Log debug message
   */
  debug(
    message: string,
    context: string,
    metadata?: Record<string, any>,
  ): void {
    this.log('debug', message, context, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, context: string, metadata?: Record<string, any>): void {
    this.log('info', message, context, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, context: string, metadata?: Record<string, any>): void {
    this.log('warn', message, context, metadata);
  }

  /**
   * Log error message
   */
  error(
    message: string,
    context: string,
    error?: Error,
    metadata?: Record<string, any>,
  ): void {
    this.log('error', message, context, {
      ...metadata,
      error: error ? this.formatError(error) : undefined,
    });
  }

  /**
   * Format error for logging
   */
  private formatError(error: Error): Record<string, string> {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack ?? '',
    };
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  sanitizeBody<T>(body: T): Partial<T> {
    if (!body) return body;

    const sensitiveFields = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'authorization',
      'apiKey',
      'key',
    ];

    const sanitized = { ...(body as any) };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Get recent security activities for a specific user
   * @param userId The user ID to get activities for
   * @param options Optional filtering and pagination options
   */
  async getRecentActivities(
    userId: string,
    options: {
      limit?: number;
      includeEvents?: AuthEventType[];
      excludeEvents?: AuthEventType[];
      fromDate?: Date;
    } = {},
  ): Promise<SecurityLog[]> {
    const { limit = 20, includeEvents, excludeEvents, fromDate } = options;

    // Build query to get recent security logs for the user
    const query: Record<string, any> = {
      userId: userId,
    };

    // Add event filtering if specified
    if (includeEvents && includeEvents.length > 0) {
      query.event = { $in: includeEvents };
    } else if (excludeEvents && excludeEvents.length > 0) {
      query.event = { $nin: excludeEvents };
    }

    // Add date filtering if specified
    if (fromDate) {
      query.timestamp = { $gte: fromDate };
    }

    // Find the logs, sorted by newest first
    const logs = await this.securityLogModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
      .exec();

    return logs;
  }
}
