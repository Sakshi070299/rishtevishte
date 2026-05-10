/**
 * Vercel serverless entry. Do not use app.listen() here — Vercel invokes this per request.
 * Local dev still uses src/main.ts + Fastify.
 */
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Request, type Response } from 'express';
import serverless from 'serverless-http';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

let cached: ReturnType<typeof serverless> | undefined;

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!cached) {
    const expressApp = express();
    expressApp.use(express.json({ limit: '5mb' }));
    expressApp.use(express.urlencoded({ extended: true, limit: '5mb' }));

    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
      logger: ['error', 'warn'],
    });
    await configureApp(app);
    await app.init();
    cached = serverless(expressApp);
  }
  cached(req, res);
}

