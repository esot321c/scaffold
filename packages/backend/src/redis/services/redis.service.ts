import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AppConfig } from '@/config/configuration';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggingService } from '@/logging/services/logging.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private connection: Redis;
  private redisConnected = false;
  private previouslyConnected = false;

  constructor(
    private config: AppConfig,
    private eventEmitter: EventEmitter2,
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
      this.loggingService.info('Redis connected', 'RedisService');

      // Track state change
      const wasDisconnected = this.redisConnected === false;
      this.redisConnected = true;

      // Only emit recovery event if this isn't the first connection
      if (wasDisconnected && this.previouslyConnected) {
        this.emitRedisRecovery();
      }

      this.previouslyConnected = true;
    });

    this.connection.on('error', (error) => {
      this.loggingService.error(
        'Redis connection error',
        'RedisService',
        error,
      );

      const wasConnected = this.redisConnected;
      this.redisConnected = false;

      // Only notify on state change
      if (wasConnected) {
        this.emitRedisFailure(error);
      }
    });
  }

  async onModuleDestroy() {
    if (this.connection) {
      await this.connection.quit();
      this.loggingService.info('Redis connection closed', 'RedisService');
    }
  }

  /**
   * Emit Redis failure event
   */
  private emitRedisFailure(error: Error): void {
    this.eventEmitter.emit('redis.connection.lost', {
      timestamp: new Date(),
      error: error.message,
      stack: error.stack,
    });
  }

  /**
   * Emit Redis recovery event
   */
  private emitRedisRecovery(): void {
    this.eventEmitter.emit('redis.connection.restored', {
      timestamp: new Date(),
    });
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

  /**
   * Check if Redis is currently connected
   */
  isConnected(): boolean {
    return this.redisConnected;
  }
}
