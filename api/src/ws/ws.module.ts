import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { DocumentsModule } from '../documents/documents.module';
import { SecurityLogger } from '../common/security-logger.service';

@Module({
  imports: [DatabaseModule, RedisModule, DocumentsModule],
  providers: [WsGateway, SecurityLogger],
})
export class WsModule {}
