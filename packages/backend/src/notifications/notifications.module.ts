import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { NotificationsService } from './services/notifications.service';
import { NotificationQueueService } from './services/notification-queue.service';
import { EmailTemplateService } from './services/email-template.service';
import { NotificationProcessor } from './processors/notification.processor';
import { AdminNotificationsController } from './controllers/admin-notifications.controller';
import { RedisModule } from '@/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AdminNotificationsController],
  providers: [
    NotificationsService,
    NotificationQueueService,
    EmailTemplateService,
    NotificationProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
