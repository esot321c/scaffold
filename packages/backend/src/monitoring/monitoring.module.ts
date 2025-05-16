import { Module } from '@nestjs/common';
import { SystemHealthService } from './services/system-health.service';
import { DatabaseHealthListener } from './listeners/database-health.listener';
import { RedisHealthListener } from './listeners/redis-health.listener';
import { MongoDBHealthListener } from './listeners/mongodb-health.listener';

@Module({
  providers: [
    SystemHealthService,
    DatabaseHealthListener,
    RedisHealthListener,
    MongoDBHealthListener,
  ],
  exports: [SystemHealthService],
})
export class MonitoringModule {}
