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
import { LogsController } from './admin/controllers/logs/logs.controller';

@Module({
  imports: [
    CommonModule,
    AppConfigModule,
    MongoDBModule,
    LoggingModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    AdminModule,
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
