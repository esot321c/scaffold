import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongoDBHealthService } from './services/mongodb-health.service';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri =
          configService.get<string>('MONGODB_URI') ||
          'mongodb://localhost:27017/logging';
        const user = configService.get<string>('MONGODB_USER');
        const password = configService.get<string>('MONGODB_PASSWORD');

        return {
          uri,
          ...(user && password
            ? { user, pass: password, authSource: 'admin' }
            : {}),
        };
      },
    }),
  ],
  providers: [MongoDBHealthService],
  exports: [MongooseModule, MongoDBHealthService],
})
export class MongoDBModule {}
