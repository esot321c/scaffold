import { Test, TestingModule } from '@nestjs/testing';
import { SystemHealthService } from './system-health.service';

describe('SystemHealthService', () => {
  let service: SystemHealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SystemHealthService],
    }).compile();

    service = module.get<SystemHealthService>(SystemHealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
