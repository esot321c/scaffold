import { Module, Global } from '@nestjs/common';
import { AdminLogsController } from './controllers/admin-logs.controller';
import { LoggingService } from './services/logging/logging.service';
import { MongoDBModule } from '@/mongodb/mongodb.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiLogSchema } from '@/mongodb/schemas/api-log.schema';
import { SecurityLogSchema } from '@/mongodb/schemas/security-log.schema';

@Global()
@Module({
  imports: [
    PrismaModule,
    MongoDBModule,
    MongooseModule.forFeature([
      { name: 'ApiLog', schema: ApiLogSchema },
      { name: 'SecurityLog', schema: SecurityLogSchema },
    ]),
  ],
  providers: [LoggingService],
  exports: [LoggingService],
  controllers: [AdminLogsController],
})
export class LoggingModule {}
