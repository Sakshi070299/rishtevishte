// ═══════════════════════════════════════════════════════
// DONATIONS MODULE — Registration + General Donations
// Payment gateway is injected via DI — swap provider here.
// ═══════════════════════════════════════════════════════

import { Module } from '@nestjs/common';
import { DonationsController } from './donations.controller';
import { DonationsService, RazorpayGateway, PAYMENT_GATEWAY } from './donations.service';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [ProfilesModule],
  controllers: [DonationsController],
  providers: [
    DonationsService,
    { provide: PAYMENT_GATEWAY, useClass: RazorpayGateway },
  ],
  exports: [DonationsService],
})
export class DonationsModule {}
