import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from './../src/database/prisma.service';
import { HealthController } from './../src/health/health.controller';

jest.mock('./../src/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('Health endpoints (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRawUnsafe: jest.fn().mockResolvedValue([{ value: 1 }]),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  it('/v1/health/live (GET)', () => {
    return request(app.getHttpServer())
      .get('/v1/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/v1/health/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/v1/health/ready')
      .expect(200)
      .expect({ status: 'ready' });
  });

  afterAll(async () => {
    await app.close();
  });
});
