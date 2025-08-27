import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';

@Injectable()
export class UserRepository {
  constructor(@InjectModel(User.name) private readonly model: Model<User>) {}

  create(data: Partial<User>) {
    return this.model.create(data);
  }

  findByEmail(email: string) {
    return this.model.findOne({ email }).exec();
  }
}

