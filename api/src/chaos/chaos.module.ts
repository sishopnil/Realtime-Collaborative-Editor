import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { ChaosService } from './chaos.service';
import { ChaosController } from './chaos.controller';

@Module({
  imports: [RedisModule],
  controllers: [ChaosController],
  providers: [ChaosService],
  exports: [ChaosService],
})
export class ChaosModule {}

