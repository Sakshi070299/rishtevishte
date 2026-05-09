// ═══════════════════════════════════════════════════════
// Refresh Token + Session Persistence
// Short-lived access token (15min) + long-lived refresh (30d)
// Token rotation on each refresh for security
//
// FIX: Uses dedicated Session table instead of SiteSettings.
//      Refresh now does an indexed lookup by tokenHash instead
//      of loading every refresh token in the system.
// ═══════════════════════════════════════════════════════

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import * as crypto from 'crypto';

const REFRESH_TOKEN_DAYS = 30;

@Injectable()
export class TokenService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ─── GENERATE TOKEN PAIR ──────────────────────────
  async generateTokenPair(userId: string, mobile: string, role: string) {
    // Short-lived access token (15 minutes)
    const accessToken = this.jwtService.sign(
      { sub: userId, mobile, role },
      { expiresIn: '5h' },
    );

    // Long-lived refresh token (30 days) - stored as hash in DB
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    // Delete any existing session for this entity, then create new one
    await this.prisma.session.deleteMany({ where: { userId } });
    await this.prisma.session.create({
      data: { userId, role, mobile, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken, expiresIn: 18000 }; // 900 seconds = 15 min
  }

  // ─── REFRESH ACCESS TOKEN ─────────────────────────
  async refreshAccessToken(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Indexed lookup by unique tokenHash — O(1) instead of full scan
    const session = await this.prisma.session.findUnique({ where: { tokenHash } });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token. Please login again.');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Refresh token expired. Please login again.');
    }

    // Rotate: Generate new token pair (old refresh token is now invalid)
    return this.generateTokenPair(session.userId, session.mobile, session.role);
  }

  // ─── REVOKE REFRESH TOKEN (Logout) ────────────────
  async revokeRefreshToken(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
  }

  // ─── CLEANUP EXPIRED SESSIONS ─────────────────────
  async cleanupExpiredSessions() {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
