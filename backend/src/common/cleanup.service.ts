import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { ProfilesService } from '../profiles/profiles.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private authService: AuthService,
    private tokenService: TokenService,
    private profilesService: ProfilesService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup() {
    this.logger.log('Running scheduled cleanup...');

    try {
      await this.authService.cleanupExpiredOtps();

      const sessions = await this.tokenService.cleanupExpiredSessions();
      if (sessions > 0) {
        this.logger.log(`Removed ${sessions} expired sessions`);
      }

      const expired = await this.profilesService.expireStaleProfiles();
      if (expired.count > 0) {
        this.logger.log(`Expired ${expired.count} stale profiles`);
      }

      this.logger.log('Cleanup complete');
    } catch (err) {
      this.logger.error('Cleanup failed', err);
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleUnpaidRegistrationCleanup() {
    try {
      const res = await this.profilesService.deleteUnpaidSelfRegistrationsOlderThan(15);
      if (res.deletedProfiles > 0) {
        this.logger.log(
          `Deleted ${res.deletedProfiles} unpaid self-registered profile(s) older than 15 minutes`,
        );
      }
    } catch (err) {
      this.logger.error('Unpaid registration cleanup failed', err);
    }
  }
}
