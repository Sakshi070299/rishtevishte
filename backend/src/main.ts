import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { AbstractHttpAdapter } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import * as path from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '', 10);
  const trustProxy =
    Number.isFinite(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : true;

  const adapter = new FastifyAdapter({
    bodyLimit: 5 * 1024 * 1024,
    // Important for correct client IP behind proxies / load balancers.
    // Without this, rate limiting can treat many users as the same IP.
    // SECURITY NOTE:
    // - `true` trusts `X-Forwarded-For` from *any* upstream. This is safe only if the
    //   app is not directly reachable from the public internet (only via the proxy/LB).
    // - Prefer setting TRUST_PROXY_HOPS in production (e.g. 1 for NGINX/ALB -> app).
    trustProxy,
  });

  // Capture raw body for webhook HMAC verification
  adapter.getInstance().addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req: unknown, body: Buffer, done: (err: null, result: unknown) => void) => {
      // Attach raw body for webhook signature verification
      (req as Record<string, unknown>).rawBody = body;
      try {
        done(null, JSON.parse(body.toString()));
      } catch {
        done(null, body);
      }
    },
  );

  const app = await NestFactory.create(
    AppModule,
    adapter as unknown as AbstractHttpAdapter,
    {
      logger: ['error', 'warn', 'log'],
      bodyParser: false,
    },
  );

  await configureApp(app);

  // ─── MULTIPART (Fastify) ──────────────────────────────────────────
  // Needed for file uploads (multipart/form-data).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const multipart = require('@fastify/multipart');
    (app as any).register(multipart, {
      limits: { fileSize: 5 * 1024 * 1024 },
    });
  } catch (err) {
    logger.warn(`Multipart support not enabled: ${String(err)}`);
  }

  // ─── STATIC: serve uploaded photos (local provider) ─────────────
  // UploadService stores local files under `${process.cwd()}/uploads` (or UPLOAD_DIR).
  // Expose them at `/uploads/*` so `photoUrl: "/uploads/..."` works in production.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fastifyStatic = require('@fastify/static');
    const uploadDir = process.env.UPLOAD_DIR
      ? path.resolve(process.env.UPLOAD_DIR)
      : path.join(process.cwd(), 'uploads');

    (app as any).register(fastifyStatic, {
      root: uploadDir,
      prefix: '/uploads/',
      decorateReply: false,
    });
  } catch (err) {
    logger.warn(`Uploads static serving not enabled: ${String(err)}`);
  }

  // Enable graceful shutdown hooks (SIGTERM, SIGINT)
  app.enableShutdownHooks();

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`RishteNate API running on http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);

  // Scheduled cleanup (expired OTPs, sessions, stale profiles) is handled
  // by CleanupService via @nestjs/schedule — see common/cleanup.service.ts
}

bootstrap();
