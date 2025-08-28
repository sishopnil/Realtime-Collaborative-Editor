import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { SecurityLogger } from './security-logger.service';

function opFromMethod(method: string): 'read' | 'write' {
  return method === 'GET' ? 'read' : 'write';
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: SecurityLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest() as any;
    const userId = req.user?.id;
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
    const path = req.path as string;
    const method = req.method as string;
    const op = opFromMethod(method);
    const resource = (path.split('?')[0] || '').split('/').slice(0, 3).join('/');
    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const dur = Date.now() - start;
          this.audit.log('audit.access', { userId, ip, path, resource, method, op, dur });
        },
        error: (err) => {
          const dur = Date.now() - start;
          const status = err?.status || 500;
          this.audit.log('audit.error', { userId, ip, path, resource, method, op, status, dur });
        },
      }),
    );
  }
}

