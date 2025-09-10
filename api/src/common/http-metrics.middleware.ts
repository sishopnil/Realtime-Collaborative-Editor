import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly redis: RedisService) {}

  use(req: Request & { startTime?: number }, res: Response, next: NextFunction) {
    const start = Date.now();
    req.startTime = start;
    const done = async () => {
      res.removeListener('finish', onFinish);
      res.removeListener('close', onFinish);
      const dur = Date.now() - start;
      const status = res.statusCode;
      try {
        const r = this.redis.getClient();
        await r.incr('metrics:http:requests');
        await r.incr(`metrics:http:status:${status}`);
        await r.incrbyfloat('metrics:http:latency_ms_sum', dur);
        await r.incr('metrics:http:latency_ms_count');
        // latency buckets (ms)
        const buckets = [50, 100, 200, 300, 500, 1000, 2000, 5000];
        for (const b of buckets) if (dur <= b) await r.incr(`metrics:http:latency_le:${b}`);
      } catch {}
    };
    const onFinish = () => void done();
    res.on('finish', onFinish);
    res.on('close', onFinish);
    next();
  }
}

