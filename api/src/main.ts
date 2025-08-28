import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { sanitizeRequests } from './common/middleware/sanitize-requests.middleware';
import { createRateLimitMiddleware } from './common/rate-limit.middleware';
import { RedisService } from './redis/redis.service';
import { SecurityLogger } from './common/security-logger.service';
import { AuditInterceptor } from './common/audit.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Strict security headers via Helmet, including HSTS and CSP
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    const http = (app.getHttpAdapter() as any).getInstance?.();
    if (http && typeof http.set === 'function') http.set('trust proxy', 1);
  }
  app.use(
    helmet({
      hsts: isProd
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "frame-ancestors": ["'none'"],
          "base-uri": ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // allow swagger assets
    }),
  );

  // Limit payload sizes to mitigate DoS via large bodies
  const bodyLimit = process.env.REQUEST_SIZE_LIMIT || '1mb';
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ limit: bodyLimit, extended: true }));

  app.use(cookieParser());
  app.use(sanitizeRequests());
  // Rate limiting and abuse prevention middleware
  const redis = app.get(RedisService);
  const audit = app.get(SecurityLogger);
  app.use(createRateLimitMiddleware(redis, audit));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // Strict CORS allowlist (comma-separated origins)
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor(), app.get(AuditInterceptor));

  const config = new DocumentBuilder()
    .setTitle('Realtime Collaborative Editor API')
    .setDescription('API documentation')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api/docs', app, document);
  const port = process.env.PORT || 4000;
  await app.listen(port);
}

bootstrap();
