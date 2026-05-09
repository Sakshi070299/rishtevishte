import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma ORM 7+: DB URL lives here for CLI (migrate, db execute, etc.), not in schema.prisma.
// PrismaService uses the same env var via @prisma/adapter-pg at runtime.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://127.0.0.1:5432/placeholder?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx ts-node prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
