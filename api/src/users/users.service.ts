import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { hashPassword } from '../common/security';
import { UserRepository } from '../database/repositories/user.repo';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class UsersService {
  constructor(private readonly users: UserRepository) {}

  async register(input: RegisterDto) {
    const exists = await this.users.findByEmail(input.email);
    if (exists) throw new ConflictException('Email already in use');
    const passwordHash = await hashPassword(bcrypt, input.password);
    const user = await this.users.create({ email: input.email, passwordHash, name: input.name });
    return { id: (user as any)._id, email: user.email, name: user.name };
  }
}
