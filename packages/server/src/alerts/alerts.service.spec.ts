import { AlertType } from '@koh/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AlertFactory,
  CourseFactory,
  initFactoriesFromService,
  QuestionFactory,
  QueueFactory,
  TACourseFactory,
  UserFactory,
} from '../../test/util/factories';
import { TestTypeOrmModule } from '../../test/util/testUtils';
import { AlertModel } from './alerts.entity';
import { AlertsService } from './alerts.service';
import { QueueModel } from '../queue/queue.entity';
import { DataSource } from 'typeorm';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';

describe('Alerts service', () => {
  let service: AlertsService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, FactoryModule],
      providers: [AlertsService],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    dataSource = module.get<DataSource>(DataSource);

    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  async function createAlerts(queue: QueueModel): Promise<AlertModel> {
    const closedQuestion = await QuestionFactory.create({
      createdAt: new Date(Date.now() - 90000),
      closedAt: new Date(),
      queue: queue,
    });

    const openQuestion = await QuestionFactory.create({
      queue,
    });

    await AlertFactory.create({
      user: closedQuestion.creator,
      course: queue.course,
      payload: {
        questionId: closedQuestion.id,
        queueId: queue.id,
        courseId: queue.course.id,
      },
    });

    return await AlertFactory.create({
      user: openQuestion.creator,
      course: queue.course,
      payload: {
        questionId: openQuestion.id,
        queueId: queue.id,
        courseId: queue.course.id,
      },
    });
  }

  describe('remove stale alerts', () => {
    it('removes stale alerts', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });

      const queue = await QueueFactory.create({
        course,
        staffList: [ta.user],
      });

      const openAlert = await createAlerts(queue);

      expect(
        (await AlertModel.find({ where: { courseId: queue.course.id } }))
          .length,
      ).toBe(2);

      const nonStaleAlerts = await service.removeStaleAlerts(
        await AlertModel.find({ where: { courseId: queue.course.id } }),
      );

      expect(nonStaleAlerts.length).toBe(1);
      expect(nonStaleAlerts[0].id).toBe(openAlert.id);
    });
  });

  describe('check payload type', () => {
    it('correct rephrase question payloads pass', () => {
      expect(
        service.assertPayloadType(AlertType.REPHRASE_QUESTION, {
          courseId: 2,
          queueId: 1,
          questionId: 420,
        }),
      ).toBeTruthy();
    });

    it('incorrect rephrase question payloads fail', () => {
      expect(
        service.assertPayloadType(AlertType.REPHRASE_QUESTION, {
          courseId: 'PYHUGYHIF',
          queueId: 1,
          questionId: 420,
        }),
      ).toBeFalsy();

      expect(
        service.assertPayloadType(AlertType.REPHRASE_QUESTION, {
          courseId: 69,
          questionId: 420,
        }),
      ).toBeFalsy();

      expect(
        service.assertPayloadType(AlertType.REPHRASE_QUESTION, {
          courseId: 69,
          queueId: '12',
          questionId: 420,
        }),
      ).toBeFalsy();
    });
  });

  describe('getting unresolved alerts for the rephrase question type', () => {
    it('gets unresolved alerts', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });
      const queue = await QueueFactory.create({
        course,
        staffList: [ta.user],
      });
      const openAlert = await createAlerts(queue);
      await service.removeStaleAlerts(
        await AlertModel.find({ where: { courseId: queue.course.id } }),
      );

      const unresolvedAlerts = await service.getUnresolvedRephraseQuestionAlert(
        queue.id,
      );

      expect(unresolvedAlerts.length).toBe(1);
      expect(unresolvedAlerts[0].id).toBe(openAlert.id);
      expect(unresolvedAlerts[0].resolved).toBeNull();
      expect(unresolvedAlerts[0].alertType).toBe(AlertType.REPHRASE_QUESTION);
      expect(unresolvedAlerts[0].payload['queueId']).toBe(queue.id);
    });
  });
});
