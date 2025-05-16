import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { NotificationsService } from './services/notifications.service';
import { NotificationQueueService } from './services/notification-queue.service';
import { EmailTemplateService } from './services/email-template.service';
import { NotificationProcessor } from './processors/notification.processor';
import { AdminNotificationsController } from './controllers/admin-notifications.controller';
import { RedisModule } from '@/redis/redis.module';
import { DigestProcessorService } from './services/digest-processor.service';
import { ErrorHandlingService } from '@/common/services/error-handling.service';
import { CommonModule } from '@/common/common.module';

@Module({
  imports: [RedisModule, PrismaModule, CommonModule],
  controllers: [AdminNotificationsController],
  providers: [
    NotificationsService,
    NotificationQueueService,
    EmailTemplateService,
    NotificationProcessor,
    ErrorHandlingService,
    DigestProcessorService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
