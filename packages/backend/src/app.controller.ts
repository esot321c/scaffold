import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get basic api info' })
  getHello() {
    return this.appService.getHello();
  }

  @Get('ping')
  @ApiOperation({ summary: 'Health check endpoint' })
  ping(): string {
    return 'pong';
  }
}
