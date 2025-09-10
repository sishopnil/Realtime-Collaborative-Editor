import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

function canonicalizePath(path: string) {
  // replace Mongo ObjectId-like and UUIDs with :id
  return path
    .replace(/[a-f0-9]{24}/gi, ':id')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id');
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request & { startTime?: number; traceId?: string }, res: Response, next: NextFunction) {
    const start = Date.now();
    req.startTime = start;
    const traceId = (req.headers['x-trace-id'] as string) || Math.random().toString(36).slice(2);
    req.traceId = traceId;
    res.setHeader('x-trace-id', traceId);
    const ua = (req.headers['user-agent'] as string) || '';
    const ip = ((req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '').toString();
    const path = canonicalizePath(req.path);
    res.on('finish', () => {
      const rec = {
        ts: new Date().toISOString(),
        level: 'info',
        traceId,
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: Date.now() - start,
        ip,
        ua,
        userId: (req as any)?.user?.id || undefined,
      } as any;
      try {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(rec));
      } catch {}
    });
    next();
  }
}

