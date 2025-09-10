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

  findById(id: string) {
    return this.model.findById(id).exec();
  }

  search(q: string, limit = 10) {
    const query: any = {};
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ email: rx }, { name: rx }];
    }
    return this.model.find(query).limit(limit).select({ email: 1, name: 1 }).lean().exec();
  }

  async updateById(id: string, update: Partial<User>) {
    return this.model.findByIdAndUpdate(id, update, { new: true }).exec();
  }
}
