import { Module, Global } from '@nestjs/common';
import { HttpExceptionFilter } from './exceptions/http-exception.filter';
import { MonitoringModule } from '@/monitoring/monitoring.module';
import { NotificationThrottleService } from './services/notification-throttle.service';
import { ErrorHandlingService } from './services/error-handling.service';

@Global()
@Module({
  imports: [MonitoringModule],
  providers: [
    HttpExceptionFilter,
    NotificationThrottleService,
    ErrorHandlingService,
  ],
  exports: [
    HttpExceptionFilter,
    NotificationThrottleService,
    ErrorHandlingService,
  ],
})
export class CommonModule {}
