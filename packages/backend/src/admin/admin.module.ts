import { Module } from '@nestjs/common';
import { ConfigController } from './config/config.controller';
import { AdminUsersController } from './users/users.controller';
import { StatsController } from './stats/stats.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConfigController, AdminUsersController, StatsController],
})
export class AdminModule {}
