import { Test, TestingModule } from '@nestjs/testing';
import { NotificationQueueService } from './notification-queue.service';

describe('NotificationQueueService', () => {
  let service: NotificationQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationQueueService],
    }).compile();

    service = module.get<NotificationQueueService>(NotificationQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
