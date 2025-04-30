import { Injectable } from '@nestjs/common';
import { type ApiStatus } from '@scaffold/types';

@Injectable()
export class AppService {
  getHello(): ApiStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.0.1',
    };
  }
}
