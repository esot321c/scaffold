import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// THIS CREATED CIRCULAR DEPENDENCIES
// TODO
// REFACTOR THE FOLLOWING:

// - combine health check and the throttle service into one place
// - allow prisma and redis to emit events to the health check service, instead of waiting for monitor to scan them
// - have notifications triggered via an event emitter

// import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// import { PrismaClient } from '../generated/prisma/client';
// import { EventEmitter2 } from '@nestjs/event-emitter';
// import { SystemEventType } from '@scaffold/types';
// import { NotificationThrottleService } from '@/common/services/notification-throttle.service';

// @Injectable()
// export class PrismaService
//   extends PrismaClient
//   implements OnModuleInit, OnModuleDestroy
// {
//   private isConnected = false;

//   constructor(
//     private eventEmitter: EventEmitter2,
//     private throttleService: NotificationThrottleService,
//   ) {
//     super();
//     // @ts-ignore - Workaround for Prisma client event typing limitations
//     this.$on('error', (error: Error) => {
//       this.handleConnectionIssue(error);
//     });
//   }

//   async onModuleInit() {
//     try {
//       await this.$connect();
//       this.isConnected = true;
//       // Reset throttle
//       this.throttleService.resetThrottle(
//         SystemEventType.DATABASE_CONNECTION_LOST,
//         'database',
//       );
//     } catch (error) {
//       this.handleConnectionIssue(error as Error);
//     }
//   }

//   async onModuleDestroy() {
//     await this.$disconnect();
//   }

//   /**
//    * Handle database connection issues
//    */
//   private async handleConnectionIssue(error: Error): Promise<void> {
//     const wasConnected = this.isConnected;
//     this.isConnected = false;

//     // Only notify on state change or if not throttled
//     if (
//       wasConnected &&
//       !this.throttleService.shouldThrottle(
//         SystemEventType.DATABASE_CONNECTION_LOST,
//         'database',
//       )
//     ) {
//       // Use the standardized notification event
//       this.eventEmitter.emit('notification.send', {
//         type: SystemEventType.DATABASE_CONNECTION_LOST,
//         data: {
//           description: 'Database connection failure detected',
//           severity: 'critical',
//           service: 'database',
//           details: {
//             error: error.message,
//             timestamp: new Date().toISOString(),
//           },
//         },
//         source: 'prisma-service',
//       });
//     }
//   }
// }
