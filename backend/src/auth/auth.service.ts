import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TokenService } from './token.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationChannel } from '@prisma/client';
import { LoginType } from './auth.dto';
import * as crypto from 'crypto';

// OTP config
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCKOUT_MINUTES = 15;
const OTP_RATE_LIMIT_SECONDS = 60;
const OTP_MAX_PER_HOUR = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private notifications: NotificationsService,
  ) {}

  // ─── SEND OTP ─────────────────────────────────────
  async sendOtp(mobile: string, loginType: LoginType = LoginType.USER) {
    // For TEAM/MANAGER/ADMIN, check the user exists with the required role
    if (loginType === LoginType.TEAM || loginType === LoginType.MANAGER || loginType === LoginType.ADMIN) {
      const user = await this.prisma.user.findUnique({ where: { mobile } });
      if (!user || !user.isActive || user.role !== loginType) {
        const label =
          loginType === LoginType.TEAM ? 'team member'
          : loginType === LoginType.MANAGER ? 'manager'
          : 'admin';
        throw new BadRequestException(`Mobile not registered as ${label}`);
      }
    }

    const now = new Date();

    // Rate limit (60s):
    // Only consider *unverified* OTPs. After a successful login we mark OTPs as
    // verified, and blocking re-login for the next 60 seconds makes UX worse.
    const recentOtp = await this.prisma.otp.findFirst({
      where: {
        mobile,
        verified: false,
        createdAt: { gt: new Date(Date.now() - OTP_RATE_LIMIT_SECONDS * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Reuse existing valid OTP (improves UX when user re-enters same number)
    const existingValidOtp = await this.prisma.otp.findFirst({
      where: {
        mobile,
        verified: false,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingValidOtp) {
      const isMock = process.env.OTP_PROVIDER === 'mock';
      return {
        success: true,
        skipSend: true,
        message: 'OTP already sent. Please use the same OTP.',
        ...(isMock && process.env.NODE_ENV !== 'production' && { devOtp: existingValidOtp.code }),
      };
    }

    // If no valid OTP exists, enforce the 60s rate limit before sending a new one
    if (recentOtp) {
      throw new BadRequestException(`Please wait ${OTP_RATE_LIMIT_SECONDS} seconds before requesting another OTP`);
    }

    // Rate limit: max OTPs per hour
    const otpsLastHour = await this.prisma.otp.count({
      where: {
        mobile,
        createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (otpsLastHour >= OTP_MAX_PER_HOUR) {
      throw new BadRequestException('Too many OTP requests. Please try after 1 hour.');
    }

    // Invalidate all previous unused OTPs for this mobile (only when issuing a new OTP)
    await this.prisma.otp.updateMany({
      where: { mobile, verified: false },
      data: { expiresAt: new Date(0) },
    });

    // Generate cryptographically secure 6-digit OTP
    const isMock = process.env.OTP_PROVIDER === 'mock';
    const code = isMock ? '123456' : this.generateSecureOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otp.create({
      data: { mobile, code, expiresAt },
    });

    // Send OTP via SMS and WhatsApp (skip in mock mode)
    if (!isMock) {
      this.notifications.send({
        mobile,
        channel: NotificationChannel.SMS,
        type: 'OTP',
        // Keep OTP out of persisted `content` (Notification rows).
        // MSG91 Flow uses vars to inject OTP into the DLT template.
        content: 'OTP login request',
        vars: { numeric: code, otp: code },
      }).catch((err) => this.logger.error('SMS OTP error', err));

      this.notifications.send({
        mobile,
        channel: NotificationChannel.WHATSAPP,
        type: 'OTP',
        content: `Your RishteNate OTP is ${code}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share with anyone.`,
      }).catch((err) => this.logger.error('WhatsApp OTP error', err));
    }

    return {
      success: true,
      skipSend: false,
      message: 'OTP sent successfully',
      ...(isMock && process.env.NODE_ENV !== 'production' && { devOtp: code }),
    };
  }

  // ─── VERIFY OTP ───────────────────────────────────
  async verifyOtp(mobile: string, code: string, loginType: LoginType = LoginType.USER) {
    // Check lockout
    const otpsWithAttempts = await this.prisma.otp.findMany({
      where: {
        mobile,
        createdAt: { gt: new Date(Date.now() - OTP_LOCKOUT_MINUTES * 60 * 1000) },
      },
      select: { attempts: true },
    });
    const totalAttempts = otpsWithAttempts.reduce((sum: number, o: { attempts: number }) => sum + (o.attempts || 0), 0);

    if (totalAttempts >= OTP_MAX_ATTEMPTS) {
      throw new ForbiddenException(`Too many failed attempts. Account locked for ${OTP_LOCKOUT_MINUTES} minutes.`);
    }

    // Find valid OTP
    const otp = await this.prisma.otp.findFirst({
      where: {
        mobile,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('No valid OTP found. Please request a new one.');
    }

    // Timing-safe comparison
    const isValid =
      otp.code.length === code.length &&
      crypto.timingSafeEqual(
        Buffer.from(otp.code, 'utf8'),
        Buffer.from(code, 'utf8'),
      );

    if (!isValid) {
      await this.prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: (otp.attempts || 0) + 1 },
      });

      const remaining = OTP_MAX_ATTEMPTS - totalAttempts - 1;
      if (remaining <= 0) {
        await this.prisma.otp.update({
          where: { id: otp.id },
          data: { expiresAt: new Date(0) },
        });
        throw new ForbiddenException(`Too many failed attempts. Account locked for ${OTP_LOCKOUT_MINUTES} minutes.`);
      }

      throw new UnauthorizedException(`Invalid OTP. ${remaining} attempt(s) remaining.`);
    }

    // Mark OTP as verified
    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { verified: true, expiresAt: new Date(0) },
    });

    // ─── UNIFIED USER RESOLUTION ──────────────────
    // All roles live in the same User table. For USER logins, upsert.
    // For TEAM/ADMIN, the user must already exist (created by admin).
    let user;
    if (loginType === LoginType.USER) {
      user = await this.prisma.user.upsert({
        where: { mobile },
        update: { lastLoginAt: new Date() },
        create: { mobile, role: 'USER' },
      });
    } else {
      user = await this.prisma.user.findUnique({ where: { mobile } });
      if (!user || !user.isActive || user.role !== loginType) {
        const label =
          loginType === LoginType.TEAM ? 'team member'
          : loginType === LoginType.MANAGER ? 'manager'
          : 'admin';
        throw new ForbiddenException(`Mobile not registered as ${label}`);
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    // Generate access + refresh token pair
    const tokens = await this.tokenService.generateTokenPair(user.id, user.mobile, user.role);

    return {
      ...tokens,
      user: { id: user.id, mobile: user.mobile, role: user.role, name: user.name },
    };
  }

  // ─── GET CURRENT USER ─────────────────────────────
  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, mobile: true, name: true, email: true,
        role: true, isSuperAdmin: true, isActive: true,
        lastLoginAt: true, createdAt: true,
      },
    });
  }

  // ─── HELPERS ──────────────────────────────────────
  private generateSecureOtp(): string {
    const buffer = crypto.randomBytes(4);
    const num = buffer.readUInt32BE(0) % 900000 + 100000;
    return num.toString();
  }

  async cleanupExpiredOtps() {
    await this.prisma.otp.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}
