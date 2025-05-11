import { Module } from '@nestjs/common';
import { ConfigController } from './controllers/config/config.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminUsersController } from './controllers/users/users.controller';
import { StatsController } from './controllers/stats/stats.controller';
import { LogsController } from './controllers/logs/logs.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ConfigController, AdminUsersController, StatsController, LogsController],
})
export class AdminModule {}
