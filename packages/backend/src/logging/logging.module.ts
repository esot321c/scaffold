import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ApiLogSchema } from './schemas/api-log.schema';
import { SecurityLogSchema } from './schemas/security-log.schema';
import { AdminLogsController } from './controllers/admin-logs.controller';
import { LoggingService } from './services/logging/logging.service';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ??
          'mongodb://localhost:27017/logging',
        connectionName: 'logging',
        user: configService.get<string>('MONGODB_USER'),
        pass: configService.get<string>('MONGODB_PASSWORD'),
      }),
    }),
    MongooseModule.forFeature(
      [
        { name: 'ApiLog', schema: ApiLogSchema },
        { name: 'SecurityLog', schema: SecurityLogSchema },
      ],
      'logging',
    ),
  ],
  providers: [LoggingService],
  exports: [LoggingService],
  controllers: [AdminLogsController],
})
export class LoggingModule {}
