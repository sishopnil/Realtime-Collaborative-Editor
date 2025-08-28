import { NextFunction, Request, Response } from 'express';

function cleanObject(obj: any, depth = 0): any {
  if (!obj || typeof obj !== 'object' || depth > 10) return obj;
  if (Array.isArray(obj)) return obj.map((v) => cleanObject(v, depth + 1));
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$') || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = cleanObject(v as any, depth + 1);
  }
  return out;
}

export function sanitizeRequests() {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = cleanObject(req.body);
    req.query = cleanObject(req.query);
    req.params = cleanObject(req.params);
    next();
  };
}
