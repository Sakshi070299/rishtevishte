import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

/** Shared HTTP setup for both Fastify (local) and Express (Vercel serverless). */
export async function configureApp(app: NestFastifyApplication): Promise<void>;
export async function configureApp(app: INestApplication): Promise<void>;
export async function configureApp(
  app: INestApplication | NestFastifyApplication,
): Promise<void> {
  const nest = app as INestApplication;

  // Allow embedding uploaded images across origins (frontend != backend).
  // Without this, browsers may block <img src="http(s)://api/uploads/..."> with CORP=same-origin.
  nest.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // Support comma-separated origins via FRONTEND_URL (e.g., "http://localhost:3000,https://prod.example.com")
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,https://rishtenate-frontend.vercel.app')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  nest.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  });

  nest.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Standardized error responses + request tracing
  nest.useGlobalFilters(new GlobalExceptionFilter());
  nest.useGlobalInterceptors(new LoggingInterceptor());

  nest.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('RishteNate API')
    .setDescription('Temple Matrimony Platform API — Mandir (Vercel + Neon edition)')
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(nest, config);
  SwaggerModule.setup('api/docs', nest, document);
}
