import { Test, TestingModule } from '@nestjs/testing';
import { NotificationThrottleService } from './notification-throttle.service';

describe('NotificationThrottleService', () => {
  let service: NotificationThrottleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationThrottleService],
    }).compile();

    service = module.get<NotificationThrottleService>(NotificationThrottleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
