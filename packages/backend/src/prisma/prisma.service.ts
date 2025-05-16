// import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// import { PrismaClient } from '../generated/prisma/client';

// @Injectable()
// export class PrismaService
//   extends PrismaClient
//   implements OnModuleInit, OnModuleDestroy
// {
//   async onModuleInit() {
//     await this.$connect();
//   }

//   async onModuleDestroy() {
//     await this.$disconnect();
//   }
// }

/**
 * PrismaService provides database connectivity and event emission for database health monitoring.
 *
 * ARCHITECTURAL NOTE:
 * This service intentionally uses NestJS's built-in Logger instead of the custom LoggingService
 * to avoid circular dependencies. Since PrismaService is a fundamental dependency for many services
 * (including the LoggingService itself), adding a LoggingService dependency here would create
 * circular import chains.
 *
 * Instead, this service:
 * 1. Uses NestJS's native logger for basic logging needs
 * 2. Emits database health events that are captured by health listeners
 * 3. Those listeners then use the full LoggingService for comprehensive logging
 *
 * This pattern maintains the separation of concerns while avoiding dependency cycles.
 * Critical database state changes are still properly monitored through the event system,
 * and no functionality is lost - just implemented differently to maintain a clean architecture.
 */

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private isConnected = false;
  private recoveryInterval: NodeJS.Timeout | null = null;
  private readonly RECOVERY_CHECK_INTERVAL = 5000; // 5 seconds
  private readonly logger = new Logger(PrismaService.name);

  constructor(private eventEmitter: EventEmitter2) {
    super();

    // Monitor connection issues
    // @ts-ignore - Workaround for Prisma client event typing limitations
    this.$on('error', (error: Error) => {
      this.handleConnectionIssue(error);
    });
  }

  async onModuleInit() {
    try {
      this.logger.log('Initializing Prisma connection');
      await this.$connect();
      this.isConnected = true;
      this.logger.log('Prisma connection established successfully');
    } catch (error) {
      this.logger.error(
        `Failed to connect to database: ${error.message}`,
        error.stack,
      );
      this.handleConnectionIssue(error as Error);
    }
  }

  async onModuleDestroy() {
    this.stopRecoveryCheck();
    await this.$disconnect();
  }

  /**
   * Start recovery check interval
   * Only runs when the database is known to be down
   */
  private startRecoveryCheck() {
    // Don't start if already running
    if (this.recoveryInterval) {
      return;
    }

    this.logger.log('Starting database recovery check interval');

    this.recoveryInterval = setInterval(async () => {
      try {
        // Simple query to check connection
        await this.$queryRaw`SELECT 1`;

        // If we get here, the connection is working again
        this.logger.log(
          'Database connection re-established during recovery check',
        );
        this.isConnected = true;

        // Stop the recovery check interval
        this.stopRecoveryCheck();

        // Emit recovery event
        this.emitConnectionRestored();
      } catch (error) {
        // Still disconnected, continue checking
        this.logger.debug('Database still disconnected during recovery check');
      }
    }, this.RECOVERY_CHECK_INTERVAL);
  }

  /**
   * Stop the recovery check interval
   */
  private stopRecoveryCheck() {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
      this.logger.log('Stopped database recovery check interval');
    }
  }

  /**
   * Handle database connection issues
   */
  private handleConnectionIssue(error: Error): void {
    const wasConnected = this.isConnected;
    this.isConnected = false;

    // Only notify on state change from connected to disconnected
    if (wasConnected) {
      this.logger.error(
        `Database connection lost: ${error.message}`,
        error.stack,
      );
      this.emitConnectionLost(error);

      // Start checking for recovery
      this.startRecoveryCheck();
    }
  }

  private emitConnectionLost(error: Error): void {
    this.logger.error(
      `Emitting database connection lost event: ${error.message}`,
    );

    this.eventEmitter.emit('database.connection.lost', {
      timestamp: new Date(),
      error: error.message,
      stack: error.stack,
    });
  }

  private emitConnectionRestored(): void {
    this.logger.log('Database connection restored - emitting recovery event');

    this.eventEmitter.emit('database.connection.restored', {
      timestamp: new Date(),
      downtime: this.getDowntimeInfo(),
    });
  }

  /**
   * Get information about the downtime for inclusion in recovery notification
   */
  private getDowntimeInfo(): { startedAt?: Date; duration?: string } {
    // TODO
    // Implementation will track when the connection was lost
    // and calculate the duration of the outage
    // This is a placeholder implementation
    return {
      duration: 'unknown',
    };
  }
}
