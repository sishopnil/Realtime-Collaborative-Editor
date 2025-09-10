import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
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
import { UxController } from './ux/ux.controller';
import { SearchModule } from './search/search.module';
import { SharingModule } from './sharing/sharing.module';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { HttpMetricsMiddleware } from './common/http-metrics.middleware';
import { PrometheusController } from './metrics/prometheus.controller';
import { ChaosModule } from './chaos/chaos.module';
import { FeaturesController } from './features/features.controller';
import { FeaturesService } from './features/features.service';
import { ChaosMiddleware } from './common/chaos.middleware';

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
    ChaosModule,
  ],
  controllers: [HealthController, SecurityController, MetricsController, PrometheusController, UxController, FeaturesController],
  providers: [AuditInterceptor, SecurityLogger, FeaturesService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware, HttpMetricsMiddleware, ChaosMiddleware).forRoutes('*');
  }
}
