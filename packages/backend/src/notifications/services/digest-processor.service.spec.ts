import { Test, TestingModule } from '@nestjs/testing';
import { DigestProcessorService } from './digest-processor.service';

describe('DigestProcessorService', () => {
  let service: DigestProcessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DigestProcessorService],
    }).compile();

    service = module.get<DigestProcessorService>(DigestProcessorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
