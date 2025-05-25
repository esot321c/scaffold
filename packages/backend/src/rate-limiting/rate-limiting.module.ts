import { Module } from '@nestjs/common';
import { RedisModule } from '@/redis/redis.module';
import { RateLimiterService } from './services/rate-limiter.service';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { RateLimitController } from './controllers/rate-limiter.controller';
import { RateLimiterGuard } from './guards/rate-limiter.guard';
import { PrismaModule } from '@/prisma/prisma.module';
import { LoggingModule } from '@/logging/logging.module';

@Module({
  imports: [RedisModule, ConfigModule, PrismaModule, LoggingModule],
  providers: [
    RateLimiterService,
    RateLimiterGuard,
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },
  ],
  exports: [RateLimiterService, RateLimiterGuard],
  controllers: [RateLimitController],
})
export class RateLimitingModule {}
