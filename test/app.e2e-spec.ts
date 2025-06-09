import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as pactum from 'pactum';
import { CreateReminderDto } from 'src/reminders/dto';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.setGlobalPrefix('api');

    await app.init();
    await app.listen(3001);
    pactum.request.setBaseUrl('http://localhost:3001/api');
  });

  it('POST /reminders and return 201 with a reminder object', async () => {
    const reminderDto: CreateReminderDto = {
      email: 'john@doe.com',
      pattern: 'once',
      sendAt: new Date(Date.now() + 10000),
    };

    await pactum
      .spec()
      .post('/reminders')
      .withBody(reminderDto)
      .expectStatus(201)
      .expectBodyContains('id')
      .stores('id', 'id');
  });

  it('GET /reminders/pending and return an array of reminder objects', async () => {
    await pactum.spec().get('/reminders/pending').expectStatus(200);
  });

  it('DELETE /reminders/{id} and return 204', async () => {
    await pactum
      .spec()
      .delete('/reminders/{id}')
      .withPathParams('id', '$S{id}')
      .expectStatus(204);
  });

  afterAll(async () => {
    await app.close();
  });
});
