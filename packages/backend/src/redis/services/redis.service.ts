import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AppConfig } from '@/config/configuration';
import Redis from 'ioredis';
import { LoggingService } from '@/logging/services/logging.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private connection: Redis;

  constructor(
    private config: AppConfig,
    private loggingService: LoggingService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.redisConfig.url;

    // BullMQ requires these specific settings
    this.connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
    });

    this.connection.on('connect', () => {
      this.loggingService.info('Redis connected for BullMQ', 'RedisService');
    });

    this.connection.on('error', (error) => {
      this.loggingService.error(
        'Redis connection error',
        'RedisService',
        error,
      );
    });
  }

  async onModuleDestroy() {
    if (this.connection) {
      await this.connection.quit();
      this.loggingService.info('Redis connection closed', 'RedisService');
    }
  }

  /**
   * Get the Redis connection for BullMQ
   */
  getConnection(): Redis {
    if (!this.connection) {
      throw new Error('Redis connection not initialized');
    }
    return this.connection;
  }
}
