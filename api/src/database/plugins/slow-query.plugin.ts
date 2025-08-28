import { Schema } from 'mongoose';

export function slowQueryPlugin(schema: Schema, opts?: { thresholdMs?: number }) {
  const threshold = opts?.thresholdMs ?? parseInt(process.env.MONGO_SLOW_MS || '200', 10);
  function wrap(op: string) {
    schema.pre(op as any, function (next) {
      (this as any).__start = Date.now();
      next();
    });
    schema.post(op as any, function () {
      const start = (this as any).__start as number | undefined;
      if (start) {
        const dur = Date.now() - start;
        if (dur >= threshold) {
          const model = (this as any).model?.modelName || 'unknown';
          console.warn(`[mongo:slow] ${model}.${op} took ${dur}ms`);
        }
      }
    });
  }
  ['find', 'findOne', 'updateOne', 'updateMany', 'aggregate', 'save'].forEach(wrap);
}
