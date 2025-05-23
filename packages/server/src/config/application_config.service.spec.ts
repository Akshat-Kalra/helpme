import { DataSource } from 'typeorm';
import { ApplicationConfigService } from './application_config.service';
import { Test, TestingModule } from '@nestjs/testing';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';

describe('ApplicationConfigService', () => {
  let service: ApplicationConfigService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule],
      providers: [ApplicationConfigService],
    }).compile();

    service = module.get<ApplicationConfigService>(ApplicationConfigService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  describe('loadConfig', () => {
    it('should load the config from the database', async () => {
      await service.loadConfig();

      expect(service.get('max_async_questions')).toBe('100');
      expect(service.get('max_queues_per_course')).toBe('30');
      expect(service.get('max_question_types_per_queue')).toBe('20');
      expect(service.get('max_questions_per_queue')).toBe('30');
      expect(service.get('max_semesters')).toBe('40');
    });
  });
});
