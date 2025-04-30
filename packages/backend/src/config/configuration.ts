import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './env.validation';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppConfig {
  constructor(
    private configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  get redisConfig() {
    return {
      url: this.configService.get('REDIS_URL', { infer: true }),
    };
  }

  get postgresConfig() {
    return {
      url: this.configService.get('DATABASE_URL', { infer: true }),
    };
  }

  get baseUrl() {
    return {
      url: this.configService.get('BASE_URL', { infer: true }),
    };
  }

  get auth() {
    return {
      jwtSecret: this.configService.get('JWT_SECRET', { infer: true }),
      google: {
        clientId: this.configService.get('GOOGLE_CLIENT_ID', { infer: true }),
        clientSecret: this.configService.get('GOOGLE_CLIENT_SECRET', {
          infer: true,
        }),
      },
      // linkedin: {
      //   clientId: this.configService.get('LINKEDIN_CLIENT_ID', { infer: true }),
      //   clientSecret: this.configService.get('LINKEDIN_CLIENT_SECRET', {
      //     infer: true,
      //   }),
      // },
      frontendUrl: this.configService.get('FRONTEND_URL', { infer: true }),
    };
  }

  get isProduction() {
    return this.configService.get('NODE_ENV', { infer: true }) === 'production';
  }
}
