import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { UserRepository } from '../database/repositories/user.repo';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly users: UserRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) throw new UnauthorizedException('Missing bearer token');
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
