import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ChaosService } from '../chaos/chaos.service';

function matchPath(path: string, include?: string[], exclude?: string[]) {
  const test = (arr?: string[]) =>
    Array.isArray(arr) && arr.length > 0
      ? arr.some((p) => {
          try {
            const rx = new RegExp(p);
            return rx.test(path);
          } catch {
            return false;
          }
        })
      : false;
  if (exclude && test(exclude)) return false;
  if (!include || include.length === 0) return true; // default include all
  return test(include);
}

@Injectable()
export class ChaosMiddleware implements NestMiddleware {
  constructor(private readonly chaos: ChaosService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const cfg = await this.chaos.getConfig();
    const http = cfg?.http;
    const enabled = !!cfg?.enabled && !!http;
    if (!enabled) return next();
    if (!matchPath(req.path, http?.includePaths, http?.excludePaths)) return next();

    const min = Math.max(0, Number(http?.minLatencyMs || 0));
    const max = Math.max(min, Number(http?.maxLatencyMs || 0));
    const p = Math.max(0, Math.min(1, Number(http?.failureRate || 0)));
    const latency = max > 0 ? Math.floor(min + Math.random() * (max - min)) : 0;
    const fail = Math.random() < p;

    const proceed = () => {
      if (fail) {
        res.status(500).json({ error: 'chaos: injected failure' });
      } else {
        next();
      }
    };

    if (latency > 0) setTimeout(proceed, latency);
    else proceed();
  }
}

