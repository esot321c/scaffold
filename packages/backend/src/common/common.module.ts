import { Module, Global, forwardRef } from '@nestjs/common';
import { HttpExceptionFilter } from './exceptions/http-exception.filter';
import { MonitoringModule } from '@/monitoring/monitoring.module';

@Global()
@Module({
  imports: [forwardRef(() => MonitoringModule)], // use forwardRef here to handle potential circular dependencies between CommonModule and MonitoringModule
  providers: [HttpExceptionFilter],
  exports: [HttpExceptionFilter],
})
export class CommonModule {}
