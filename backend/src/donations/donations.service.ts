import { Injectable, BadRequestException, InternalServerErrorException, ForbiddenException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import { DonationType, PaymentStatus, ProfileStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

// ─── PAYMENT GATEWAY INTERFACE ──────────────────────
// Abstract interface — swap Razorpay for Stripe/PayU/Cashfree
// by implementing this interface and registering the new provider.

export interface PaymentGateway {
  readonly name: string;
  readonly clientKey: string; // Public key for frontend checkout SDK
  createOrder(amount: number, currency: string, receipt: string, notes: Record<string, string>): Promise<{ orderId: string }>;
  verifySignature(orderId: string, paymentId: string, signature: string): boolean;
  verifyWebhookSignature(body: string, signature: string): boolean;
}

export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';

// ─── RAZORPAY IMPLEMENTATION ────────────────────────

@Injectable()
export class RazorpayGateway implements PaymentGateway {
  readonly name = 'razorpay';
  readonly clientKey: string;
  private secret: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private razorpay: any;

  constructor() {
    this.clientKey = process.env.RAZORPAY_KEY_ID!;
    this.secret = process.env.RAZORPAY_KEY_SECRET!;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Razorpay = require('razorpay');
    this.razorpay = new Razorpay({
      key_id: this.clientKey,
      key_secret: this.secret,
    });
  }

  async createOrder(amount: number, currency: string, receipt: string, notes: Record<string, string>): Promise<{ orderId: string }> {
    const order = await this.razorpay.orders.create({ amount, currency, receipt, notes });
    return { orderId: order.id };
  }

  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return (
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'))
    );
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || this.secret)
      .update(body)
      .digest('hex');

    return (
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'))
    );
  }
}

// ─── DONATIONS SERVICE ──────────────────────────────

@Injectable()
export class DonationsService {
  constructor(
    private prisma: PrismaService,
    private profilesService: ProfilesService,
    @Inject(PAYMENT_GATEWAY) private gateway: PaymentGateway,
  ) {}

  // ─── CREATE DONATION / PAYMENT ORDER ──────────────
  async createDonation(data: {
    userId?: string;
    profileId?: string;
    type: DonationType;
    amount: number; // in rupees
    donorName?: string;
    donorMobile?: string;
    donorEmail?: string;
    splitCashRupees?: number;
    splitOnlineRupees?: number;
    splitFreeRupees?: number;
    splitFreeApprovedBy?: string;
    splitFreeReason?: string;
    splitPaymentMethods?: string[];
    /** @deprecated Parsed into split* when those fields are not sent */
    notes?: string;
  }) {
    let splitCashRupees = data.splitCashRupees;
    let splitOnlineRupees = data.splitOnlineRupees;
    let splitFreeRupees = data.splitFreeRupees;
    let splitFreeApprovedBy = data.splitFreeApprovedBy;
    let splitFreeReason = data.splitFreeReason;
    let splitPaymentMethods = [...(data.splitPaymentMethods ?? [])];

    const legacy = data.notes?.trim();
    if (legacy) {
      try {
        const j = JSON.parse(legacy) as Record<string, unknown>;
        if (splitCashRupees === undefined && typeof j.cashAmount === 'number') splitCashRupees = j.cashAmount;
        if (splitOnlineRupees === undefined && typeof j.onlineAmount === 'number') splitOnlineRupees = j.onlineAmount;
        if (splitFreeRupees === undefined && typeof j.freeAmount === 'number') splitFreeRupees = j.freeAmount;
        if (splitFreeApprovedBy === undefined && typeof j.freeApprovedBy === 'string') splitFreeApprovedBy = j.freeApprovedBy;
        if (splitFreeReason === undefined && typeof j.freeReason === 'string') splitFreeReason = j.freeReason;
        if (splitPaymentMethods.length === 0 && Array.isArray(j.paymentMethods)) {
          splitPaymentMethods = (j.paymentMethods as unknown[]).filter((x): x is string => typeof x === 'string');
        }
      } catch {
        /* ignore invalid legacy JSON */
      }
    }

    if (data.amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    if (data.type === DonationType.REGISTRATION) {
      if (!data.userId) throw new ForbiddenException('Login required for registration payment');
      if (!data.profileId) throw new BadRequestException('profileId is required for registration donations');
    }

    // Authorization: if profileId is provided, it must belong to the requester.
    if (data.profileId) {
      if (!data.userId) throw new ForbiddenException('Login required for profile-linked donation');
      const profile = await this.prisma.profile.findUnique({
        where: { id: data.profileId },
        select: { id: true, userId: true, createdById: true },
      });
      if (!profile) throw new NotFoundException('Profile not found');
      // Allow both:
      // 1) the profile owner (profile.userId)
      // 2) the STAFF user who created the profile (profile.createdById)
      if (profile.userId !== data.userId && profile.createdById !== data.userId) {
        throw new ForbiddenException('Not your profile');
      }
    }

    const amountInPaisa = Math.round(data.amount * 100);
    const receipt = `don_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    let orderId: string;
    try {
      const result = await this.gateway.createOrder(amountInPaisa, 'INR', receipt, {
        type: data.type,
        donorName: data.donorName || '',
        donorMobile: data.donorMobile || '',
      });
      orderId = result.orderId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Payment gateway error: ${message}`);
    }

    const donation = await this.prisma.donation.create({
      data: {
        userId: data.userId,
        profileId: data.profileId,
        type: data.type,
        amount: amountInPaisa,
        gateway: this.gateway.name,
        gatewayOrderId: orderId,
        donorName: data.donorName,
        donorMobile: data.donorMobile,
        donorEmail: data.donorEmail,
        splitCashRupees,
        splitOnlineRupees,
        splitFreeRupees,
        splitFreeApprovedBy,
        splitFreeReason,
        splitPaymentMethods,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    return {
      donationId: donation.id,
      orderId,
      amount: data.amount,
      currency: 'INR',
      key: this.gateway.clientKey,
    };
  }

  // ─── VERIFY PAYMENT ───────────────────────────────
  async verifyPayment(userId: string | undefined, data: {
    donationId: string;
    gatewayPaymentId: string;
    gatewayOrderId: string;
    gatewaySignature: string;
  }) {
    const donation = await this.prisma.donation.findUnique({
      where: { id: data.donationId },
      select: { id: true, userId: true, profileId: true, type: true, paymentStatus: true },
    });
    if (!donation) throw new NotFoundException('Donation not found');
    // If donation is linked to a user, only that user can verify it.
    if (donation.userId) {
      if (!userId) throw new ForbiddenException('Login required to verify this donation');
      if (donation.userId !== userId) throw new ForbiddenException('Not your donation');
    }

    // Verify signature via gateway abstraction
    const isSigValid = this.gateway.verifySignature(
      data.gatewayOrderId,
      data.gatewayPaymentId,
      data.gatewaySignature,
    );

    if (!isSigValid) {
      await this.prisma.donation.updateMany({
        where: { id: data.donationId, userId, paymentStatus: PaymentStatus.PENDING },
        data: { paymentStatus: PaymentStatus.FAILED },
      });
      throw new BadRequestException('Invalid payment signature');
    }

    // Generate invoice number before transaction
    const invoiceNumber = await this.generateInvoiceNumber();

    // Atomic: mark donation complete + activate profile in one transaction.
    const result = await this.prisma.$transaction(async (tx) => {
      const updateWhere: Prisma.DonationWhereInput = donation.userId
        ? { id: data.donationId, userId: donation.userId, paymentStatus: PaymentStatus.PENDING }
        : { id: data.donationId, paymentStatus: PaymentStatus.PENDING };

      const updateResult = await tx.donation.updateMany({
        where: updateWhere,
        data: {
          gatewayPaymentId: data.gatewayPaymentId,
          gatewaySignature: data.gatewaySignature,
          paymentStatus: PaymentStatus.COMPLETED,
          invoiceNumber,
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException('Donation not pending or already processed');
      }

      // If registration donation, activate the profile within same transaction
      if (donation.profileId && donation.type === DonationType.REGISTRATION) {
        await tx.profile.update({
          where: { id: donation.profileId },
          data: { status: ProfileStatus.ACTIVE },
        });
      }

      return tx.donation.findUnique({ where: { id: data.donationId } });
    });

    return { success: true, donation: result ?? donation };
  }

  // ─── WEBHOOK PAYMENT CONFIRMATION ──────────────────
  // Called by gateway webhook — no userId check needed (server-to-server).
  async handleWebhook(rawBody: string, signature: string) {
    if (!this.gateway.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody);
    // Razorpay sends event: 'payment.captured' / 'payment.failed'
    const event = payload.event as string;
    const paymentEntity = payload.payload?.payment?.entity;

    if (!paymentEntity?.order_id) {
      return { status: 'ignored', event };
    }

    const gatewayOrderId = paymentEntity.order_id as string;
    const gatewayPaymentId = paymentEntity.id as string;

    const donation = await this.prisma.donation.findUnique({
      where: { gatewayOrderId },
      select: { id: true, profileId: true, type: true, paymentStatus: true },
    });

    if (!donation || donation.paymentStatus !== PaymentStatus.PENDING) {
      return { status: 'skipped', reason: 'not found or already processed' };
    }

    if (event === 'payment.captured') {
      const webhookInvoice = await this.generateInvoiceNumber();
      await this.prisma.$transaction(async (tx) => {
        await tx.donation.update({
          where: { gatewayOrderId },
          data: {
            gatewayPaymentId,
            paymentStatus: PaymentStatus.COMPLETED,
            invoiceNumber: webhookInvoice,
          },
        });

        if (donation.profileId && donation.type === DonationType.REGISTRATION) {
          await tx.profile.update({
            where: { id: donation.profileId },
            data: { status: ProfileStatus.ACTIVE },
          });
        }
      });

      return { status: 'completed', donationId: donation.id };
    }

    if (event === 'payment.failed') {
      await this.prisma.donation.update({
        where: { gatewayOrderId },
        data: { gatewayPaymentId, paymentStatus: PaymentStatus.FAILED },
      });
      return { status: 'failed', donationId: donation.id };
    }

    return { status: 'ignored', event };
  }

  // ─── GENERATE INVOICE NUMBER ─────────────────────
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seqName = `invoice_seq_${year}`;
    await this.prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1`);
    const result = await this.prisma.$queryRawUnsafe<[{ nextval: bigint }]>(`SELECT nextval('"${seqName}"')`);
    const num = Number(result[0].nextval);
    return `INV-${year}-${num.toString().padStart(4, '0')}`;
  }

  // ─── GET SINGLE INVOICE ─────────────────────────
  async getInvoice(donationId: string) {
    const donation = await this.prisma.donation.findUnique({
      where: { id: donationId },
      include: {
        user: { select: { name: true, mobile: true, email: true } },
        profile: { select: { fullName: true, registrationNumber: true, fatherName: true, guardianPhone: true } },
      },
    });
    if (!donation) throw new NotFoundException('Donation not found');
    if (donation.paymentStatus !== 'COMPLETED') throw new BadRequestException('Invoice only available for completed payments');

    return {
      invoiceNumber: donation.invoiceNumber,
      date: donation.updatedAt,
      type: donation.type,
      amount: donation.amount / 100,
      currency: donation.currency,
      gateway: donation.gateway,
      gatewayPaymentId: donation.gatewayPaymentId,
      donor: {
        name: donation.donorName || donation.user?.name || donation.profile?.fullName || 'N/A',
        mobile: donation.donorMobile || donation.user?.mobile || donation.profile?.guardianPhone || 'N/A',
        email: donation.donorEmail || donation.user?.email || '',
      },
      profile: donation.profile ? {
        name: donation.profile.fullName,
        registrationNumber: donation.profile.registrationNumber,
      } : null,
      temple: {
        name: 'Mandir',
        address: 'Hanuman Murti Chowk, Ram Lila Ground, Geeta Colony, East Delhi - 110031',
        committee: 'Geeta Colony Dharmik Ramlila Committee',
      },
    };
  }

  // ─── SALES SUMMARY (Weekly/Monthly/Yearly) ──────
  async getSalesSummary(period: 'weekly' | 'monthly' | 'yearly' = 'monthly') {
    const now = new Date();
    let since: Date;
    switch (period) {
      case 'weekly': since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'monthly': since = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'yearly': since = new Date(now.getFullYear(), 0, 1); break;
    }

    const [completed, pending, failed, refunded, totalAllTime] = await Promise.all([
      this.prisma.donation.aggregate({
        where: { paymentStatus: 'COMPLETED', createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.donation.aggregate({
        where: { paymentStatus: 'PENDING', createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.donation.aggregate({
        where: { paymentStatus: 'FAILED', createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.donation.aggregate({
        where: { paymentStatus: 'REFUNDED', createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.donation.aggregate({
        where: { paymentStatus: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // By type breakdown
    const [regSales, genSales] = await Promise.all([
      this.prisma.donation.aggregate({
        where: { type: 'REGISTRATION', paymentStatus: 'COMPLETED', createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.donation.aggregate({
        where: { type: 'GENERAL', paymentStatus: 'COMPLETED', createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      period,
      since: since.toISOString(),
      completed: {
        count: completed._count,
        amount: (completed._sum.amount || 0) / 100,
      },
      pending: {
        count: pending._count,
        amount: (pending._sum.amount || 0) / 100,
      },
      failed: { count: failed._count },
      refunded: {
        count: refunded._count,
        amount: (refunded._sum.amount || 0) / 100,
      },
      byType: {
        registration: { count: regSales._count, amount: (regSales._sum.amount || 0) / 100 },
        general: { count: genSales._count, amount: (genSales._sum.amount || 0) / 100 },
      },
      allTime: {
        count: totalAllTime._count,
        amount: (totalAllTime._sum.amount || 0) / 100,
      },
    };
  }

  // ─── GET DONATION HISTORY ─────────────────────────
  async getDonations(filters?: {
    userId?: string;
    type?: DonationType;
    status?: PaymentStatus;
    page?: number;
    limit?: number;
  }) {
    const where: {
      userId?: string;
      type?: DonationType;
      paymentStatus?: PaymentStatus;
    } = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.paymentStatus = filters.status;

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const [data, total] = await Promise.all([
      this.prisma.donation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { profile: { select: { fullName: true, registrationNumber: true } } },
      }),
      this.prisma.donation.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }
}
