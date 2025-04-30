import { Module } from '@nestjs/common';
import { ConfigController } from './config/config.controller';
import { AdminUsersController } from './users/users.controller';
import { AdminLogsController } from './logs/logs.controller';
import { StatsController } from './stats/stats.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    ConfigController,
    AdminUsersController,
    AdminLogsController,
    StatsController,
  ],
})
export class AdminModule {}
