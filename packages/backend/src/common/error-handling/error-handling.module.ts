import { Module } from '@nestjs/common';
import { ErrorHandlingService } from './services/error-handling.service';

@Module({
  providers: [ErrorHandlingService],
})
export class ErrorHandlingModule {}
