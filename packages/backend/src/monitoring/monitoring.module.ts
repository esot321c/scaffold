import { Module } from '@nestjs/common';
import { SystemHealthService } from './services/system-health.service';
import { NotificationsModule } from '@/notifications/notifications.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { RedisModule } from '@/redis/redis.module';

@Module({
  imports: [NotificationsModule, PrismaModule, RedisModule],
  providers: [SystemHealthService],
  exports: [SystemHealthService],
})
export class MonitoringModule {}
