import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { UserRepository } from '../database/repositories/user.repo';
import { RedisService } from '../redis/redis.service';
import bcrypt from 'bcryptjs';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly users: UserRepository, private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) {
      // Fallback: accept share token for guest/anonymous access
      const shareToken = (req.headers['x-share-token'] as string) || (req.query as any)?.shareToken;
      if (!shareToken) throw new UnauthorizedException('Missing bearer token');
      const recRaw = await this.redis.getClient().get(`share:link:${shareToken}`);
      if (!recRaw) throw new UnauthorizedException('Invalid or expired token');
      const rec = JSON.parse(recRaw);
      // optional password check
      const pass = (req.headers['x-share-pass'] as string) || (req.query as any)?.sharePass;
      if (rec.passwordHash) {
        if (!pass) throw new UnauthorizedException('Share password required');
        const ok = await bcrypt.compare(pass, rec.passwordHash);
        if (!ok) throw new UnauthorizedException('Invalid share password');
      }
      req.user = { id: `guest:${shareToken}`, guest: true, share: { token: shareToken, documentId: rec.documentId, role: rec.role, allowAnonymousComment: !!rec.allowAnonymousComment } };
      return true;
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme') as any;
      const user = await this.users.findById(payload.sub);
      if (!user) throw new UnauthorizedException('Invalid user');
      req.user = { id: (user as any)._id, email: user.email, name: user.name };
      return true;
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
