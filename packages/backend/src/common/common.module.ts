import { Module, Global } from '@nestjs/common';
import { HttpExceptionFilter } from './exceptions/http-exception.filter';
import { MonitoringModule } from '@/monitoring/monitoring.module';
import { ErrorHandlingModule } from './error-handling/error-handling.module';
import { NotificationThrottleService } from './services/notification-throttle.service';

@Global()
@Module({
  imports: [MonitoringModule, ErrorHandlingModule],
  providers: [HttpExceptionFilter, NotificationThrottleService],
  exports: [HttpExceptionFilter, NotificationThrottleService],
})
export class CommonModule {}
