import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AuthGuard } from './auth.guard';
import { SecurityLogger } from '../common/security-logger.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [AuthService, AuthGuard, SecurityLogger],
  controllers: [AuthController],
  exports: [AuthGuard],
})
export class AuthModule {}
