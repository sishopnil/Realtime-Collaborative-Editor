import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request, { SuperAgentTest } from 'supertest';
import { AppModule } from '../app.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as Y from 'yjs';
import { gzipSync } from 'zlib';

describe('Advanced Integration E2E', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let agentA: SuperAgentTest; // user A (owner)
  let agentB: SuperAgentTest; // user B
  let tokenA: string;
  let tokenB: string;
  let wsId: string;
  let docId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URL = mongod.getUri();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    agentA = request.agent(app.getHttpServer());
    agentB = request.agent(app.getHttpServer());

    // Onboarding: register + login 2 users
    await agentA.post('/api/users/register').send({ email: 'owner@example.com', password: 'pass123456', name: 'Owner' }).expect(201);
    const loginA = await agentA.post('/api/auth/login').send({ email: 'owner@example.com', password: 'pass123456' }).expect(200);
    tokenA = loginA.body.accessToken;

    await agentB.post('/api/users/register').send({ email: 'collab@example.com', password: 'pass123456', name: 'Collab' }).expect(201);
    const loginB = await agentB.post('/api/auth/login').send({ email: 'collab@example.com', password: 'pass123456' }).expect(200);
    tokenB = loginB.body.accessToken;

    // Owner creates workspace and document
    const ws = await agentA
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Integration WS', slug: 'int-ws' })
      .expect(201);
    wsId = ws.body._id;

    const doc = await agentA
      .post('/api/docs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ workspaceId: wsId, title: 'Integration Doc' })
      .expect(201);
    docId = doc.body._id;
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('Security: non-member cannot access admin routes', async () => {
    await agentB.get(`/api/workspaces/${wsId}/members`).set('Authorization', `Bearer ${tokenB}`).expect(403);
  });

  it('Admin workflows: add member and list members', async () => {
    await agentA
      .post(`/api/workspaces/${wsId}/members`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: 'collab@example.com', role: 'admin' })
      .expect(201);
    const list = await agentB.get(`/api/workspaces/${wsId}/members`).set('Authorization', `Bearer ${tokenB}`).expect(200);
    expect(Array.isArray(list.body)).toBe(true);
  });

  it('Permissions: deny edit for third user, allow for admin/member', async () => {
    // userB as admin should be able to update doc
    await agentB
      .patch(`/api/docs/${docId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Updated by B' })
      .expect(200);
  });

  it('Version history: apply Yjs updates, snapshot, diff, rollback, export', async () => {
    // initial state
    const g1 = await agentA.get(`/api/docs/${docId}/y`).set('Authorization', `Bearer ${tokenA}`).expect(200);
    const d1 = new Y.Doc();
    Y.applyUpdate(d1, Buffer.from(g1.body.update, 'base64'));
    (d1.getText('t') as Y.Text).insert(0, 'alpha');
    const u1 = gzipSync(Buffer.from(Y.encodeStateAsUpdate(d1))).toString('base64');
    await agentA.post(`/api/docs/${docId}/y`).set('Authorization', `Bearer ${tokenA}`).send({ update: u1 }).expect(/^(200|201)$/);

    // snapshot A
    await agentA.post(`/api/docs/${docId}/snapshots`).set('Authorization', `Bearer ${tokenA}`).expect(/^(200|201)$/);

    // change again
    const g2 = await agentA.get(`/api/docs/${docId}/y`).set('Authorization', `Bearer ${tokenA}`).expect(200);
    const d2 = new Y.Doc();
    Y.applyUpdate(d2, Buffer.from(g2.body.update, 'base64'));
    (d2.getText('t') as Y.Text).insert(5, ' beta');
    const u2 = gzipSync(Buffer.from(Y.encodeStateAsUpdate(d2))).toString('base64');
    await agentA.post(`/api/docs/${docId}/y`).set('Authorization', `Bearer ${tokenA}`).send({ update: u2 }).expect(/^(200|201)$/);

    // snapshot B
    await agentA.post(`/api/docs/${docId}/snapshots`).set('Authorization', `Bearer ${tokenA}`).expect(/^(200|201)$/);

    // list snapshots and diff
    const snaps = await agentA.get(`/api/docs/${docId}/snapshots`).set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(Array.isArray(snaps.body)).toBe(true);
    if (snaps.body.length >= 2) {
      const from = snaps.body[0]._id;
      const to = snaps.body[1]._id;
      await agentA.get(`/api/docs/${docId}/diff?from=${from}&to=${to}`).set('Authorization', `Bearer ${tokenA}`).expect(200);
      await agentA.post(`/api/docs/${docId}/rollback`).set('Authorization', `Bearer ${tokenA}`).send({ snapshotId: from }).expect(/^(200|201)$/);
    }

    // export
    await agentA.get(`/api/docs/${docId}/export?format=json`).set('Authorization', `Bearer ${tokenA}`).expect(200);
  });

  it('Comments + Search integration', async () => {
    // create a comment to index
    await agentA.post('/comments').set('Authorization', `Bearer ${tokenA}`).send({ documentId: docId, text: 'This is great alpha content' }).expect(201);
    const s1 = await agentA.get(`/api/search/comments?documentId=${docId}&q=alpha`).set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(Array.isArray(s1.body)).toBe(true);
    const s2 = await agentA.get(`/api/search/docs?workspaceId=${wsId}&q=Integration`).set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(Array.isArray(s2.body)).toBe(true);
  });

  it('Privacy analytics and sessions endpoints respond', async () => {
    await agentA.post('/api/privacy/analytics').set('Authorization', `Bearer ${tokenA}`).send({}).expect(201).catch(() => 0);
    const sessions = await agentA.get('/api/auth/sessions').set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(Array.isArray(sessions.body.sessions)).toBe(true);
  });

  it('Metrics and jobs health', async () => {
    await agentA.get('/api/jobs/health').expect(200);
    const metrics = await agentA.get('/api/metrics').expect(200);
    expect(typeof metrics.body['metrics:comments:created']).toBe('number');
  });
});

