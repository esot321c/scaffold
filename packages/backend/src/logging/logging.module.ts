import { Module, Global } from '@nestjs/common';
import { LogsController } from './controllers/logs.controller';
import { LoggingService } from './services/logging.service';
import { AdminModule } from '@/admin/admin.module';
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
    AdminModule,
    MongooseModule.forFeature([
      { name: 'ApiLog', schema: ApiLogSchema },
      { name: 'SecurityLog', schema: SecurityLogSchema },
    ]),
  ],
  providers: [LoggingService],
  exports: [LoggingService],
  controllers: [LogsController],
})
export class LoggingModule {}
