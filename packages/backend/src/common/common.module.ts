import { Module, Global } from '@nestjs/common';
import { HttpExceptionFilter } from './exceptions/http-exception.filter';

@Global()
@Module({
  providers: [HttpExceptionFilter],
  exports: [HttpExceptionFilter],
})
export class CommonModule {}
