import { Module } from '@nestjs/common';
import { AccessPaymentsController } from './access-payments.controller';
import { AccessPaymentsService } from './access-payments.service';
import { DonationsModule } from '../donations/donations.module';

@Module({
  // DonationsModule re-exports PAYMENT_GATEWAY so we share the single Razorpay client.
  imports: [DonationsModule],
  controllers: [AccessPaymentsController],
  providers: [AccessPaymentsService],
  exports: [AccessPaymentsService],
})
export class AccessPaymentsModule {}
