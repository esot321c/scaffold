import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggingService } from '@/logging/services/logging.service';

@Injectable()
export class MongoDBHealthService implements OnModuleInit, OnModuleDestroy {
  private isConnected = false;
  private hadConnectionIssue = false;
  private recoveryInterval: NodeJS.Timeout | null = null;
  private readonly RECOVERY_CHECK_INTERVAL = 5000; // 5 seconds

  constructor(
    @InjectConnection() private mongoConnection: Connection,
    private eventEmitter: EventEmitter2,
    private loggingService: LoggingService,
  ) {}

  onModuleInit() {
    // Log initial state
    this.loggingService.info(
      `Initial MongoDB connection state: ${this.getReadyStateText()}`,
      'MongoDBHealthService',
    );

    // Set initial connection state
    this.isConnected = this.mongoConnection.readyState === 1;

    // Set up event listeners
    this.mongoConnection.on('connected', () => {
      this.loggingService.info(
        'MongoDB connected event received',
        'MongoDBHealthService',
      );

      const wasDisconnected = !this.isConnected;
      this.isConnected = true;

      // Only emit recovery if we had a previous issue
      if (wasDisconnected && this.hadConnectionIssue) {
        this.loggingService.info(
          'MongoDB reconnected after an issue - emitting recovery event',
          'MongoDBHealthService',
        );
        this.emitMongoRecovery();
        this.stopRecoveryCheck();
      }
    });

    this.mongoConnection.on('disconnected', () => {
      this.loggingService.warn(
        'MongoDB disconnected event received',
        'MongoDBHealthService',
      );

      const wasConnected = this.isConnected;
      this.isConnected = false;

      if (wasConnected) {
        this.hadConnectionIssue = true;
        this.emitMongoDisconnection();
        this.startRecoveryCheck();
      }
    });

    this.mongoConnection.on('error', (error) => {
      this.loggingService.error(
        'MongoDB connection error event received',
        'MongoDBHealthService',
        error,
      );

      const wasConnected = this.isConnected;
      this.isConnected = false;

      if (wasConnected) {
        this.hadConnectionIssue = true;
        this.emitMongoError(error);
        this.startRecoveryCheck();
      }
    });
  }

  onModuleDestroy() {
    this.stopRecoveryCheck();
  }

  /**
   * Start recovery check interval
   * Only runs when MongoDB is known to be down
   */
  private startRecoveryCheck() {
    // Don't start if already running
    if (this.recoveryInterval) {
      return;
    }

    this.loggingService.info(
      'Starting MongoDB recovery check interval',
      'MongoDBHealthService',
    );

    this.recoveryInterval = setInterval(() => {
      try {
        // Check current connection state
        const currentState = this.mongoConnection.readyState;

        this.loggingService.debug(
          `MongoDB recovery check - current state: ${this.getReadyStateText(currentState)}`,
          'MongoDBHealthService',
        );

        // If connection is restored
        if (currentState === 1 && !this.isConnected) {
          this.loggingService.info(
            'MongoDB connection re-established during recovery check',
            'MongoDBHealthService',
          );

          this.isConnected = true;
          this.stopRecoveryCheck();
          this.emitMongoRecovery();
        }
      } catch (error) {
        // Error during check
        this.loggingService.debug(
          'Error during MongoDB recovery check',
          'MongoDBHealthService',
          { error: error instanceof Error ? error.message : String(error) },
        );
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
      this.loggingService.info(
        'Stopped MongoDB recovery check interval',
        'MongoDBHealthService',
      );
    }
  }

  /**
   * Helper method to convert readyState numeric values to text
   */
  private getReadyStateText(state?: number): string {
    const currentState = state ?? this.mongoConnection.readyState;

    switch (currentState) {
      case 0:
        return 'disconnected';
      case 1:
        return 'connected';
      case 2:
        return 'connecting';
      case 3:
        return 'disconnecting';
      default:
        return `unknown (${currentState})`;
    }
  }

  private emitMongoError(error: Error): void {
    this.loggingService.info(
      'Emitting MongoDB connection error event',
      'MongoDBHealthService',
    );

    this.eventEmitter.emit('mongodb.connection.error', {
      timestamp: new Date(),
      error: error.message,
      stack: error.stack,
    });
  }

  private emitMongoDisconnection(): void {
    this.loggingService.info(
      'Emitting MongoDB connection lost event',
      'MongoDBHealthService',
    );

    this.eventEmitter.emit('mongodb.connection.lost', {
      timestamp: new Date(),
    });
  }

  private emitMongoRecovery(): void {
    this.loggingService.info(
      'Emitting MongoDB connection restored event',
      'MongoDBHealthService',
    );

    this.eventEmitter.emit('mongodb.connection.restored', {
      timestamp: new Date(),
    });

    // Reset the flag after successful recovery notification
    this.hadConnectionIssue = false;
  }
}
