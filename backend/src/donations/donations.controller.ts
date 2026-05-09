import { Controller, Post, Get, Body, Query, Param, UseGuards, Request, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { DonationsService } from './donations.service';
import { CreateDonationDto, VerifyPaymentDto, ListDonationsQueryDto } from './donations.dto';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';

type JwtRequest = { user?: { sub: string }; rawBody?: Buffer };

@ApiTags('Donations')
@Controller('donations')
export class DonationsController {
  constructor(private donationsService: DonationsService) {}

  @Post()
  @UseGuards(OptionalAuthGuard)
  async create(@Request() req: JwtRequest, @Body() dto: CreateDonationDto) {
    return this.donationsService.createDonation({
      ...dto,
      userId: req.user?.sub,
    });
  }

  @Post('verify')
  @UseGuards(OptionalAuthGuard)
  async verify(@Request() req: JwtRequest, @Body() dto: VerifyPaymentDto) {
    return this.donationsService.verifyPayment(req.user?.sub, dto);
  }

  // ─── PAYMENT WEBHOOK (no auth — server-to-server) ─
  // Uses raw body bytes for HMAC verification (not re-serialized JSON).
  @Post('webhook')
  @SkipThrottle()
  async webhook(
    @Request() req: { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString() || '';
    return this.donationsService.handleWebhook(rawBody, signature);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  async list(@Request() req: JwtRequest, @Query() query: ListDonationsQueryDto) {
    return this.donationsService.getDonations({
      userId: req.user!.sub,
      type: query.type,
      status: query.status as never,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':id/invoice')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  async getInvoice(@Param('id') id: string) {
    return this.donationsService.getInvoice(id);
  }
}
