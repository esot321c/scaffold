import { Module } from '@nestjs/common';
import { ConfigController } from './controllers/config.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminUsersController } from './controllers/users.controller';
import { StatsController } from './controllers/stats.controller';
import { LogsController } from './controllers/logs.controller';
import { HealthController } from './controllers/health.controller';
import { SystemHealthService } from '@/monitoring/services/system-health.service';
import { RedisService } from '@/redis/services/redis.service';
import { ConfigService } from './services/config.service';

@Module({
  imports: [PrismaModule],
  providers: [ConfigService, SystemHealthService, RedisService],
  controllers: [
    ConfigController,
    AdminUsersController,
    StatsController,
    LogsController,
    HealthController,
  ],
})
export class AdminModule {}
