// ═══════════════════════════════════════════════════════
// TEAMS MODULE — Temple Volunteer Panel
// ═══════════════════════════════════════════════════════

import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [ProfilesModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
