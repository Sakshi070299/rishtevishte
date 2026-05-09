// ═══════════════════════════════════════════════════════
// PROFILES MODULE — Bride/Groom Registration + Management
// ═══════════════════════════════════════════════════════

// ─── profiles.module.ts ─────────────────────────────
import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

export { ProfilesModule };

@Module({
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
class ProfilesModule {}
