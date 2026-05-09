import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [AuthModule, ProfilesModule],
  providers: [CleanupService],
})
export class CleanupModule {}
