import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API status object with correct shape', () => {
      const result = appController.getHello();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('version', '0.0.1');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('ping', () => {
    it('should return "test"', () => {
      expect(appController.ping()).toBe('test');
    });
  });
});
