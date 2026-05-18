import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PAYMENT_GATEWAY, PaymentGateway } from '../donations/donations.service';

/** The unlock price + validity window — single source of truth. */
export const ACCESS_FEE_RUPEES = 2100;
export const ACCESS_VALID_MONTHS = 6;

@Injectable()
export class AccessPaymentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private gateway: PaymentGateway,
  ) {}

  /** Already-unlocked users don't get charged again — return the active grant. */
  private async findActiveAccess(userId: string) {
    return this.prisma.accessPayment.findFirst({
      where: {
        userId,
        paymentStatus: PaymentStatus.COMPLETED,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: 'desc' },
    });
  }

  /** Razorpay order creation. Returns the data the frontend needs to open Checkout. */
  async createOrder(userId: string) {
    const existing = await this.findActiveAccess(userId);
    if (existing) {
      return {
        alreadyUnlocked: true,
        expiresAt: existing.expiresAt,
      };
    }

    const amountInPaisa = ACCESS_FEE_RUPEES * 100;
    const receipt = `acc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    let orderId: string;
    try {
      const result = await this.gateway.createOrder(amountInPaisa, 'INR', receipt, {
        type: 'PROFILE_ACCESS',
        userId,
      });
      orderId = result.orderId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Payment gateway error: ${message}`);
    }

    const ap = await this.prisma.accessPayment.create({
      data: {
        userId,
        amount: ACCESS_FEE_RUPEES,
        gateway: this.gateway.name,
        gatewayOrderId: orderId,
        validMonths: ACCESS_VALID_MONTHS,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    return {
      alreadyUnlocked: false,
      accessPaymentId: ap.id,
      orderId,
      amount: ACCESS_FEE_RUPEES,
      currency: 'INR',
      key: this.gateway.clientKey,
      validMonths: ACCESS_VALID_MONTHS,
    };
  }

  /**
   * Verify Razorpay signature, mark the AccessPayment COMPLETED, and unlock
   * the user for `validMonths` from now.
   */
  async verifyPayment(
    userId: string,
    data: {
      accessPaymentId: string;
      gatewayOrderId: string;
      gatewayPaymentId: string;
      gatewaySignature: string;
    },
  ) {
    const ap = await this.prisma.accessPayment.findUnique({
      where: { id: data.accessPaymentId },
    });
    if (!ap) throw new NotFoundException('Access payment not found');
    if (ap.userId !== userId) throw new ForbiddenException('Not your payment');
    if (ap.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment already processed');
    }
    if (ap.gatewayOrderId !== data.gatewayOrderId) {
      throw new BadRequestException('Order ID mismatch');
    }

    const sigOk = this.gateway.verifySignature(
      data.gatewayOrderId,
      data.gatewayPaymentId,
      data.gatewaySignature,
    );
    if (!sigOk) {
      await this.prisma.accessPayment.update({
        where: { id: ap.id },
        data: { paymentStatus: PaymentStatus.FAILED },
      });
      throw new BadRequestException('Invalid payment signature');
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + ap.validMonths);

    // Atomic: complete the access payment + unlock the user in one transaction.
    await this.prisma.$transaction([
      this.prisma.accessPayment.update({
        where: { id: ap.id },
        data: {
          paymentStatus: PaymentStatus.COMPLETED,
          gatewayPaymentId: data.gatewayPaymentId,
          gatewaySignature: data.gatewaySignature,
          expiresAt,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          hasPaidAccess: true,
          accessExpiresAt: expiresAt,
        },
      }),
    ]);

    return {
      success: true,
      unlockedUntil: expiresAt,
      validMonths: ap.validMonths,
    };
  }

  /** Public status — used by the UnlockBanner on the frontend. */
  async getMyStatus(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hasPaidAccess: true, accessExpiresAt: true, role: true },
    });
    const isStaff = u && (u.role === 'TEAM' || u.role === 'MANAGER' || u.role === 'ADMIN');
    const isUnlocked =
      !!isStaff || (!!u?.hasPaidAccess && !!u?.accessExpiresAt && u.accessExpiresAt > new Date());

    return {
      isUnlocked,
      isStaff: !!isStaff,
      accessExpiresAt: u?.accessExpiresAt ?? null,
      accessFeeRupees: ACCESS_FEE_RUPEES,
      validMonths: ACCESS_VALID_MONTHS,
    };
  }
}
