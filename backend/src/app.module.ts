import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma.module';
import { CleanupModule } from './common/cleanup.module';
import { ApiThrottlerGuard } from './common/guards/throttler.guard';
import { AuthModule } from './auth/auth.module';
import { ProfilesModule } from './profiles/profiles.module';
import { SearchModule } from './search/search.module';
import { TeamsModule } from './teams/teams.module';
import { AdminModule } from './admin/admin.module';
import { DonationsModule } from './donations/donations.module';
import { AccessPaymentsModule } from './access-payments/access-payments.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PdfModule } from './pdf/pdf.module';
import { UploadModule } from './upload/upload.module';
import { PublicModule } from './public/public.module';

// Build throttler config. When REDIS_URL is set, use Redis storage
// so rate limits are shared across multiple backend instances.
// Falls back to in-memory for single-instance / dev deploys.
function buildThrottlerConfig(): ThrottlerModuleOptions {
  const base: ThrottlerModuleOptions = {
    // Multiple throttlers let us apply hybrid limits (IP-level + mobile-level)
    // without coupling them into a single composite key (which is easy to bypass).
    throttlers: [
      { name: 'global', ttl: 60000, limit: 120 },
      // defaults for OTP routes; overridden per-endpoint via @Throttle where needed
      { name: 'otp_ip', ttl: 60000, limit: 20 },
      { name: 'otp_mobile', ttl: 60000, limit: 5 },
    ],
    setHeaders: true,
  };

  if (process.env.REDIS_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ThrottlerStorageRedisService } = require('@nest-lab/throttler-storage-redis');
      base.storage = new ThrottlerStorageRedisService(process.env.REDIS_URL);
    } catch {
      // @nest-lab/throttler-storage-redis not installed — fall back to in-memory
      console.warn('REDIS_URL set but @nest-lab/throttler-storage-redis not installed. Using in-memory rate limiting.');
    }
  }

  return base;
}

@Module({
  imports: [
    // Rate limiting — Redis-backed when REDIS_URL is set
    ThrottlerModule.forRoot(buildThrottlerConfig()),

    // Cron-based scheduled tasks (cleanup, expiry, etc.)
    ScheduleModule.forRoot(),

    // Core
    PrismaModule,
    CleanupModule,

    // Feature modules
    AuthModule,
    ProfilesModule,
    SearchModule,
    TeamsModule,
    AdminModule,
    DonationsModule,
    AccessPaymentsModule,
    ReportsModule,
    NotificationsModule,
    PdfModule,
    UploadModule,
    PublicModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ApiThrottlerGuard },
  ],
})
export class AppModule {}
