import mongoose from 'mongoose';
import { HealthController } from './health.controller';

class RedisServiceMock {
  async ping() {
    return 'PONG';
  }
}

describe('HealthController', () => {
  it('should report ok with mongo status', async () => {
    // simulate connected
    // @ts-ignore
    mongoose.connection.readyState = 1;
    const ctrl = new HealthController(new RedisServiceMock() as any);
    const res = ctrl.health();
    expect(res.status).toBe('ok');
    expect(['up', 'down']).toContain(res.mongo);
  });

  it('should report ready when both mongo and redis are up', async () => {
    // @ts-ignore simulate connected
    mongoose.connection.readyState = 1;
    const ctrl = new HealthController(new RedisServiceMock() as any);
    const res = await ctrl.ready();
    expect(['ready', 'not-ready']).toContain(res.status);
    expect(res.mongo).toBe(true);
    expect(res.redis).toBe(true);
  });
});

