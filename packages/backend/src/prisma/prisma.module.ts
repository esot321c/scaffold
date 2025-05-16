import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationThrottleService } from '@/common/services/notification-throttle.service';
import { CommonModule } from '@/common/common.module';

@Module({
  imports: [EventEmitterModule.forRoot(), CommonModule],
  providers: [PrismaService, NotificationThrottleService],
  exports: [PrismaService],
})
export class PrismaModule {}
