import { Module } from '@nestjs/common';
import { SystemHealthService } from './services/system-health.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { RedisModule } from '@/redis/redis.module';

@Module({
  providers: [SystemHealthService],
  exports: [SystemHealthService],
})
export class MonitoringModule {}
