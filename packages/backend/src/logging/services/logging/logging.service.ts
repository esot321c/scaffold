import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ApiLog,
  ApiLogFilter,
  AuthEventType,
  PaginatedResponse,
  SecurityLog,
  SecurityLogFilter,
} from '@scaffold/types';

@Injectable()
export class LoggingService implements OnModuleInit {
  private logger: winston.Logger;
  private initialized: boolean = false;
  private mongoEnabled: boolean = false;
  private fileEnabled: boolean = true;
  private apiLogRetentionDays: number = 30;
  private securityLogRetentionDays: number = 30;

  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
    @InjectModel('ApiLog') private apiLogModel: Model<ApiLog>,
    @InjectModel('SecurityLog') private securityLogModel: Model<SecurityLog>,
  ) {
    // Set up a minimal bootstrap logger for initialization only
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      // Define the expected configurations with defaults
      const expectedConfigs = [
        {
          key: 'logging_mongo_enabled',
          value: 'false',
          description: 'Enable MongoDB for advanced logging features',
        },
        {
          key: 'logging_file_enabled',
          value: 'true',
          description: 'Enable file-based logging',
        },
        {
          key: 'log_level',
          value: 'info',
          description: 'Logging level (error, warn, info, debug)',
        },
        {
          key: 'api_log_retention_days',
          value: '30',
          description: 'Number of days to retain API logs',
        },
        {
          key: 'auth_log_retention_days',
          value: '90',
          description: 'Number of days to retain security logs',
        },
        {
          key: 'log_directory',
          value: 'logs',
          description: 'Directory for log files',
        },
      ];

      // First check if configs exist, create if needed
      for (const config of expectedConfigs) {
        const existingConfig = await this.prismaService.systemConfig.findUnique(
          {
            where: { key: config.key },
          },
        );

        if (!existingConfig) {
          await this.prismaService.systemConfig.create({
            data: {
              key: config.key,
              value: config.value,
              description: config.description,
            },
          });
          console.log(
            `Created missing config: ${config.key} = ${config.value}`,
          );
        }
      }

      // Get all system configurations for logging
      const configItems = await this.prismaService.systemConfig.findMany({
        where: {
          key: {
            in: expectedConfigs.map((c) => c.key),
          },
        },
      });

      // Create a map for easier access
      const configMap = new Map(
        configItems.map((item) => [item.key, item.value]),
      );

      // Get configuration values (all keys are guaranteed to exist)
      this.mongoEnabled = configMap.get('logging_mongo_enabled')! === 'true';
      this.fileEnabled = configMap.get('logging_file_enabled')! === 'true';
      const logLevel = configMap.get('log_level')!;

      // Clamp retention days between 1 and 365 days
      const rawApiDays = configMap.get('api_log_retention_days');
      this.apiLogRetentionDays = Math.max(
        1,
        Math.min(365, parseInt(rawApiDays!, 10) || 30),
      );
      const rawSecurityDays = configMap.get('auth_log_retention_days');
      this.securityLogRetentionDays = Math.max(
        1,
        Math.min(365, parseInt(rawSecurityDays!, 10) || 90),
      );

      // Create the actual configured logger
      const transports: winston.transport[] = [];

      // Always keep console in development
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
        const logDir = configMap.get('log_directory') ?? 'logs';
        transports.push(
          new winston.transports.DailyRotateFile({
            dirname: logDir,
            filename: 'application-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            ),
          }),
        );
      }

      // Create the fully configured logger
      this.logger = winston.createLogger({
        level: logLevel,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
        defaultMeta: { service: 'api' },
        transports,
        exitOnError: false,
      });

      // Check MongoDB availability and set up TTL indexes if enabled
      if (this.mongoEnabled) {
        try {
          // Setup TTL indexes
          await this.setupTtlIndexes();
        } catch (mongoError) {
          this.mongoEnabled = false;
          this.logger.warn('MongoDB logging disabled due to error:', {
            error:
              mongoError instanceof Error
                ? mongoError.message
                : String(mongoError),
            fallback: 'Using file-based logging only',
          });
        }
      }

      // Mark system as initialized
      this.initialized = true;

      this.logger.info('Logging system initialized', {
        context: 'LoggingService',
        mongoEnabled: this.mongoEnabled,
        fileEnabled: this.fileEnabled,
        apiLogRetentionDays: this.apiLogRetentionDays,
        securityLogRetentionDays: this.securityLogRetentionDays,
      });
    } catch (error) {
      console.error('Failed to initialize logging system:', error);
      // Set up a basic fallback logger
      this.logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
        transports: [
          new winston.transports.Console(),
          new winston.transports.DailyRotateFile({
            dirname: 'logs',
            filename: 'application-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
          }),
        ],
      });
      this.mongoEnabled = false;
      this.fileEnabled = true;
      this.initialized = true;
    }
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
   * Reconfigure TTL indexes based on current configuration
   */
  async reconfigureTtlIndexes(): Promise<void> {
    try {
      // Fetch the latest retention configuration
      const apiLogConfig = await this.prismaService.systemConfig.findUnique({
        where: { key: 'api_log_retention_days' },
      });

      const securityLogConfig =
        await this.prismaService.systemConfig.findUnique({
          where: { key: 'auth_log_retention_days' },
        });

      if (apiLogConfig) {
        this.apiLogRetentionDays = Math.max(
          1,
          Math.min(365, parseInt(apiLogConfig.value, 10)),
        );
      }

      if (securityLogConfig) {
        this.securityLogRetentionDays = Math.max(
          1,
          Math.min(365, parseInt(securityLogConfig.value, 10)),
        );
      }

      // Only proceed if MongoDB is enabled
      if (this.mongoEnabled) {
        await this.setupTtlIndexes();
        this.logger.info('TTL indexes reconfigured', {
          context: 'LoggingService',
          apiLogRetentionDays: this.apiLogRetentionDays,
          securityLogRetentionDays: this.securityLogRetentionDays,
        });
      }

      return;
    } catch (error) {
      this.logger.error('Failed to reconfigure TTL indexes', {
        context: 'LoggingService',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Reload logging configuration from system settings
   */
  async reloadConfiguration(): Promise<void> {
    try {
      // Refresh from the beginning
      await this.onModuleInit();
      return;
    } catch (error) {
      this.logger.error('Failed to reload logging configuration', {
        context: 'LoggingService',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
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

    // Get unique user IDs to fetch user data
    const uniqueUserIds = [...new Set(logs.map((log) => log.userId))];

    // Fetch users from Prisma in a single query
    const users = await this.prismaService.user.findMany({
      where: {
        id: {
          in: uniqueUserIds,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Create map of users by ID for efficient lookups
    const userMap = new Map(users.map((user) => [user.id, user]));

    // Enrich logs with user data
    const enrichedLogs = logs.map((log) => {
      const user = userMap.get(log.userId);
      return {
        ...log,
        user: user
          ? {
              id: user.id,
              email: user.email,
              name: user.name,
            }
          : undefined,
      };
    });

    return {
      data: enrichedLogs,
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
