import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { DocumentsModule } from './documents/documents.module';
import { AuditInterceptor } from './common/audit.interceptor';
import { SecurityController } from './security/security.controller';
import { SecurityLogger } from './common/security-logger.service';
import { WsModule } from './ws/ws.module';
import { CommentsModule } from './comments/comments.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MetricsController } from './metrics/metrics.controller';
import { SearchModule } from './search/search.module';
import { SharingModule } from './sharing/sharing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    DocumentsModule,
    WsModule,
    CommentsModule,
    NotificationsModule,
    JobsModule,
    SearchModule,
    SharingModule,
  ],
  controllers: [HealthController, SecurityController, MetricsController],
  providers: [AuditInterceptor, SecurityLogger],
})
export class AppModule {}
