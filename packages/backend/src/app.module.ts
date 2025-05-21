import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersController } from './users/users.controller';
import { UsersModule } from './users/users.module';
import { CsrfMiddleware } from './auth/middleware/csrf.middleware';
import { AdminModule } from './admin/admin.module';
import { CommonModule } from './common/common.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { LoggingModule } from './logging/logging.module';
import { ApiLoggingMiddleware } from './logging/middleware/api-logging.middleware';
import { MongoDBModule } from './mongodb/mongodb.module';
import { LogsController } from './admin/controllers/logs.controller';
import { NotificationsModule } from './notifications/notifications.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RateLimitingModule } from './rate-limiting/rate-limiting.module';

@Module({
  imports: [
    // Core infrastructure modules first
    AppConfigModule,

    // Event emitter should be early for the notification system
    EventEmitterModule.forRoot(), // Add this if not imported elsewhere globally

    // Common modules that provide shared services
    CommonModule,

    // Database and storage modules
    MongoDBModule,
    PrismaModule,
    RedisModule,

    // Logging module that depends on databases
    LoggingModule,

    // Feature modules
    AuthModule,
    UsersModule,
    AdminModule,

    // System monitoring modules last as they may depend on all other modules
    NotificationsModule,
    MonitoringModule,
    RateLimitingModule,
  ],
  controllers: [AppController, UsersController, LogsController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');

    consumer.apply(ApiLoggingMiddleware).forRoutes('*');

    consumer
      .apply(CsrfMiddleware)
      .exclude(
        { path: 'auth/google', method: RequestMethod.GET },
        { path: 'auth/google/callback', method: RequestMethod.GET },
        { path: 'auth/token', method: RequestMethod.POST }, // Mobile token endpoint, currently unused
      )
      .forRoutes('*');
  }
}
