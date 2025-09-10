import { Module } from '@nestjs/common';
import { SharingController } from './sharing.controller';
import { RedisModule } from '../redis/redis.module';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { SecurityLogger } from '../common/security-logger.service';

@Module({
  imports: [RedisModule, DatabaseModule, AuthModule],
  providers: [SecurityLogger],
  controllers: [SharingController],
})
export class SharingModule {}

