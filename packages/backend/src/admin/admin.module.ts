import { Module } from '@nestjs/common';
import { ConfigController } from './controllers/config.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminUsersController } from './controllers/users.controller';
import { StatsController } from './controllers/stats.controller';
import { LogsController } from './controllers/logs.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    ConfigController,
    AdminUsersController,
    StatsController,
    LogsController,
  ],
})
export class AdminModule {}
