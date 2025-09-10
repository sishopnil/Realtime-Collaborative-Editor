import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request, { SuperAgentTest } from 'supertest';
import { AppModule } from '../app.module';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('Comments E2E', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let agent: SuperAgentTest;
  let token: string;
  let wsId: string;
  let docId: string;
  let threadId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URL = mongod.getUri();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    agent = request.agent(app.getHttpServer());

    // bootstrap: user, login, workspace, doc
    await agent
      .post('/api/users/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test' })
      .expect(201);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })
      .expect(200);
    token = login.body.accessToken;
    const ws = await agent
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'WS', slug: 'ws' })
      .expect(201);
    wsId = ws.body._id;
    const doc = await agent
      .post('/api/docs')
      .set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: wsId, title: 'Doc1' })
      .expect(201);
    docId = doc.body._id;
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('Create thread with anchor + mention', async () => {
    const res = await agent
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({ documentId: docId, text: 'Hello @test@example.com', anchor: { from: 1, to: 5 } })
      .expect(201);
    expect(res.body.text).toContain('Hello');
    expect(res.body.status).toBe('open');
    threadId = res.body._id;
  });

  it('List threads for document', async () => {
    const res = await agent.get(`/comments/doc/${docId}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.find((t: any) => t._id === threadId)).toBeTruthy();
  });

  it('Reply to thread', async () => {
    const res = await agent
      .post(`/comments/${threadId}/replies`)
      .set('Authorization', `Bearer ${token}`)
      .send({ documentId: docId, text: 'Replying' })
      .expect(201);
    expect(res.body.parentId).toBe(threadId);
  });

  it('React to comment', async () => {
    const res = await agent
      .post(`/comments/${threadId}/react`)
      .set('Authorization', `Bearer ${token}`)
      .send({ emoji: '👍' })
      .expect(201);
    expect(res.body.reactions['👍']).toBeGreaterThanOrEqual(1);
  });

  it('Resolve thread', async () => {
    const res = await agent
      .post(`/comments/${threadId}/resolve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(res.body.status).toBe('resolved');
  });

  it('Search + analytics', async () => {
    const s = await agent
      .get(`/comments/search?documentId=${docId}&q=Hello`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(s.body)).toBe(true);
    const a = await agent
      .get(`/comments/analytics/${docId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(a.body?.totals?.comments).toBeGreaterThanOrEqual(1);
  });

  it('Delete thread', async () => {
    const res = await agent
      .delete(`/comments/${threadId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.deletedAt).toBeTruthy();
  });
});

