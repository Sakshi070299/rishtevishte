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
  // Export the gateway too so other modules (e.g. AccessPaymentsModule)
  // can reuse the same Razorpay client without instantiating a second one.
  exports: [DonationsService, PAYMENT_GATEWAY],
})
export class DonationsModule {}
