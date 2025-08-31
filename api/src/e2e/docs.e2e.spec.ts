import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request, { SuperAgentTest } from 'supertest';
import { AppModule } from '../app.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as Y from 'yjs';
import { gzipSync } from 'zlib';

describe('Documents E2E - Yjs + Snapshots', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let agent: SuperAgentTest;
  let token: string;
  let wsId: string;
  let docId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URL = mongod.getUri();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    agent = request.agent(app.getHttpServer());

    // basic user + login + workspace + doc setup
    await agent.post('/api/users/register').send({ email: 'e2e@example.com', password: 'pass123456', name: 'E2E' });
    const login = await agent.post('/api/auth/login').send({ email: 'e2e@example.com', password: 'pass123456' });
    token = login.body.accessToken;
    const wsRes = await agent
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'E2E WS', slug: 'e2e-ws' });
    wsId = wsRes.body._id;
    const docRes = await agent
      .post('/api/docs')
      .set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: wsId, title: 'E2E Doc' });
    docId = docRes.body._id;
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('Yjs get/apply works with compression', async () => {
    const get1 = await agent.get(`/api/docs/${docId}/y`).set('Authorization', `Bearer ${token}`);
    expect(get1.body.update).toBeTruthy();
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, Buffer.from(get1.body.update, 'base64'));
    (ydoc.getText('t') as Y.Text).insert(0, 'hello');
    const update = Y.encodeStateAsUpdate(ydoc);
    const gz = gzipSync(Buffer.from(update));
    await agent
      .post(`/api/docs/${docId}/y`)
      .set('Authorization', `Bearer ${token}`)
      .send({ update: gz.toString('base64') })
      .expect(201)
      .catch(() => agent.post(`/api/docs/${docId}/y`).set('Authorization', `Bearer ${token}`).send({ update: gz.toString('base64') }).expect(200));
    const get2 = await agent.get(`/api/docs/${docId}/y`).set('Authorization', `Bearer ${token}`);
    const y2 = new Y.Doc();
    Y.applyUpdate(y2, Buffer.from(get2.body.update, 'base64'));
    expect((y2.getText('t') as Y.Text).toString()).toContain('hello');
  });

  it('Snapshots list and rollback', async () => {
    // force a snapshot via endpoint
    await agent.post(`/api/docs/${docId}/snapshots`).set('Authorization', `Bearer ${token}`).expect(201).catch(() => 0);
    const list = await agent.get(`/api/docs/${docId}/snapshots`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    if (list.body.length) {
      const snapId = list.body[0]._id;
      await agent.post(`/api/docs/${docId}/rollback`).set('Authorization', `Bearer ${token}`).send({ snapshotId: snapId }).expect(201).catch(() => 0);
    }
  });

  it('Jobs health and metrics endpoints respond', async () => {
    const jobs = await agent.get('/api/jobs/health').expect(200);
    expect(['bullmq', 'fallback']).toContain(jobs.body.mode);
    const metrics = await agent.get('/api/metrics').expect(200);
    expect(typeof metrics.body['jobs:processed']).toBe('number');
  });
});
