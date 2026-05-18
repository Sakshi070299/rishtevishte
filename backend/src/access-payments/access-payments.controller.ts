import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AccessPaymentsService } from './access-payments.service';
import { VerifyAccessPaymentDto } from './access-payments.dto';
import { SkipThrottle } from '@nestjs/throttler';

type JwtRequest = { user: { sub: string; role: string } };

/**
 * Razorpay-backed ₹2100 unlock fee that gives a USER 6-month read access
 * to other matrimony profiles. STAFF roles bypass this entirely.
 */
@ApiTags('Access Payments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('payments/access')
export class AccessPaymentsController {
  constructor(private readonly service: AccessPaymentsService) {}

  /** Returns the current unlock status — used by UnlockBanner. */
  @Get('status')
  @SkipThrottle()
  async myStatus(@Request() req: JwtRequest) {
    return this.service.getMyStatus(req.user.sub);
  }

  /** Create a Razorpay order; the frontend opens Checkout with the result. */
  @Post('order')
  async createOrder(@Request() req: JwtRequest) {
    return this.service.createOrder(req.user.sub);
  }

  /** Verify the Razorpay signature; on success, user is unlocked for 6 months. */
  @Post('verify')
  async verify(@Request() req: JwtRequest, @Body() dto: VerifyAccessPaymentDto) {
    return this.service.verifyPayment(req.user.sub, dto);
  }
}
