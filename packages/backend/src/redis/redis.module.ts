import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { AppConfig } from 'src/config/configuration';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [AppConfig],
      useFactory: (configService: AppConfig) => {
        return {
          store: redisStore,
          url: configService.redisConfig.url,
          ttl: 60 * 60, // 1 hour
        };
      },
    }),
  ],
  exports: [CacheModule],
})
export class RedisModule {}
