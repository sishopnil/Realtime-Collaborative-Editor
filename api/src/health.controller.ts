import { Controller, Get } from '@nestjs/common';
import mongoose from 'mongoose';
import { RedisService } from './redis/redis.service';

@Controller()
export class HealthController {
  constructor(private readonly redis: RedisService) {}
  @Get('/health')
  health() {
    const mongoReady = mongoose.connection.readyState === 1;
    return { status: 'ok', mongo: mongoReady ? 'up' : 'down' };
  }

  @Get('/ready')
  async ready() {
    const mongoReady = mongoose.connection.readyState === 1;
    let redisOk = false;
    try {
      const pong = await this.redis.ping();
      redisOk = pong === 'PONG';
    } catch {}
    const ready = mongoReady && redisOk;
    return { status: ready ? 'ready' : 'not-ready', mongo: mongoReady, redis: redisOk };
  }
}
