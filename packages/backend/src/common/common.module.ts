import { Module, Global, forwardRef } from '@nestjs/common';
import { HttpExceptionFilter } from './exceptions/http-exception.filter';
import { MonitoringModule } from '@/monitoring/monitoring.module';
import { ErrorHandlingModule } from './error-handling/error-handling.module';

@Global()
@Module({
  // use forwardRef here to handle potential circular dependencies between CommonModule and MonitoringModule
  imports: [forwardRef(() => MonitoringModule), ErrorHandlingModule],
  providers: [HttpExceptionFilter],
  exports: [HttpExceptionFilter],
})
export class CommonModule {}
