import { Test, TestingModule } from '@nestjs/testing';
import { RateLimiterController } from './rate-limiter.controller';

describe('RateLimiterController', () => {
  let controller: RateLimiterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RateLimiterController],
    }).compile();

    controller = module.get<RateLimiterController>(RateLimiterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
