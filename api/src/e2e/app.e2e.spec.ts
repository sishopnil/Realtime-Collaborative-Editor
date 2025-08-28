import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request, { SuperAgentTest } from 'supertest';
import { AppModule } from '../app.module';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('API E2E', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let agent: SuperAgentTest;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URL = mongod.getUri();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('GET /health', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('POST /api/users/register', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test' })
      .expect(201);
    expect(res.body.email).toBe('test@example.com');
  });

  it('POST /api/auth/login and refresh', async () => {
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })
      .expect(200);
    expect(login.body.accessToken).toBeTruthy();
    // refresh should succeed using cookie set by login
    const refreshed = await agent.post('/api/auth/refresh').expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();
  });

  it('Workspace + Documents CRUD flow', async () => {
    // login again to ensure cookies are valid for this agent
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })
      .expect(200);
    const token = login.body.accessToken as string;

    // create workspace
    const wsRes = await agent
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test WS', slug: 'test-ws' })
      .expect(201);
    const wsId = wsRes.body._id;

    // create document
    const docRes = await agent
      .post('/api/docs')
      .set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: wsId, title: 'Doc A' })
      .expect(201);
    const docId = docRes.body._id;

    // list documents
    const listRes = await agent
      .get(`/api/docs?workspaceId=${wsId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.find((d: any) => d._id === docId)).toBeTruthy();

    // update document status to archived
    await agent
      .patch(`/api/docs/${docId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'archived' })
      .expect(200);

    // soft delete
    await agent.delete(`/api/docs/${docId}`).set('Authorization', `Bearer ${token}`).expect(200);

    // should not be in list
    const listRes2 = await agent
      .get(`/api/docs?workspaceId=${wsId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listRes2.body.find((d: any) => d._id === docId)).toBeFalsy();
  });
});
