import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AuthGuard } from './auth.guard';
import { SecurityLogger } from '../common/security-logger.service';
import { SecretsModule } from '../secrets/secrets.module';
import { JwtKeysService } from '../security/jwt-keys.service';

@Module({
  imports: [DatabaseModule, RedisModule, SecretsModule],
  providers: [AuthService, AuthGuard, SecurityLogger, JwtKeysService],
  controllers: [AuthController],
  exports: [AuthGuard],
})
export class AuthModule {}
