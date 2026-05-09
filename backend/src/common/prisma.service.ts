import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function resolveDatabaseUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  // Explicit pool defaults unless already in the URL.
  if (base.includes('connection_limit')) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}connection_limit=10&pool_timeout=30`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = resolveDatabaseUrl();
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    const adapter = new PrismaPg({ connectionString: url });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
