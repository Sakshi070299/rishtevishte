// ═══════════════════════════════════════════════════════
// ADMIN MODULE — Full System Control Panel
// ═══════════════════════════════════════════════════════

import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { DonationsModule } from '../donations/donations.module';

@Module({
  imports: [AuthModule, DonationsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
