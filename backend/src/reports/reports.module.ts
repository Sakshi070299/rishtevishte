// ═══════════════════════════════════════════════════════
// REPORTS MODULE — Admin Analytics Dashboard
// ═══════════════════════════════════════════════════════

import { Module } from '@nestjs/common';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RolesGuard, Roles } from '../common/guards/roles.guard';

// ─── SERVICE ────────────────────────────────────────
@Injectable()
class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getRegistrationStats(period: 'weekly' | 'monthly' | 'yearly' = 'monthly') {
    const now = new Date();
    let since: Date;

    switch (period) {
      case 'weekly':
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        since = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        since = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const [total, active, settled, pending, newThisPeriod] = await Promise.all([
      this.prisma.profile.count(),
      this.prisma.profile.count({ where: { status: 'ACTIVE' } }),
      this.prisma.profile.count({ where: { status: 'SETTLED' } }),
      this.prisma.profile.count({ where: { status: 'PENDING_PAYMENT' } }),
      this.prisma.profile.count({ where: { createdAt: { gte: since } } }),
    ]);

    // Gender breakdown
    const genderStats = await this.prisma.profile.groupBy({
      by: ['gender'],
      _count: true,
    });

    return { total, active, settled, pending, newThisPeriod, period, genderStats };
  }

  async getDonationStats(period: 'weekly' | 'monthly' | 'yearly' = 'monthly') {
    const now = new Date();
    let since: Date;

    switch (period) {
      case 'weekly': since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'monthly': since = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'yearly': since = new Date(now.getFullYear(), 0, 1); break;
    }

    const [registrationDonations, generalDonations] = await Promise.all([
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
      registration: {
        count: registrationDonations._count,
        totalAmount: (registrationDonations._sum.amount || 0) / 100, // paisa to rupees
      },
      general: {
        count: generalDonations._count,
        totalAmount: (generalDonations._sum.amount || 0) / 100,
      },
      grandTotal: ((registrationDonations._sum.amount || 0) + (generalDonations._sum.amount || 0)) / 100,
    };
  }

  async getTeamActivityStats(days: number = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const activities = await this.prisma.teamActivity.groupBy({
      by: ['userId', 'action'],
      where: { createdAt: { gte: since } },
      _count: true,
    });

    const loginLogs = await this.prisma.teamActivity.findMany({
      where: { action: 'LOGIN', createdAt: { gte: since } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return { activities, loginLogs, days };
  }

  async getDashboardSummary() {
    const [profiles, donations, teamMembers] = await Promise.all([
      this.getRegistrationStats('monthly'),
      this.getDonationStats('monthly'),
      this.prisma.user.count({ where: { role: 'TEAM', isActive: true } }),
    ]);

    return { profiles, donations, activeTeamMembers: teamMembers };
  }
}

// ─── CONTROLLER ─────────────────────────────────────
@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller('admin/reports')
class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  async dashboard() { return this.reportsService.getDashboardSummary(); }

  @Get('registrations')
  async registrations(@Query('period') period: 'weekly' | 'monthly' | 'yearly') {
    return this.reportsService.getRegistrationStats(period);
  }

  @Get('donations')
  async donations(@Query('period') period: 'weekly' | 'monthly' | 'yearly') {
    return this.reportsService.getDonationStats(period);
  }

  @Get('team-activity')
  async teamActivity(@Query('days') days: string) {
    return this.reportsService.getTeamActivityStats(parseInt(days || '7', 10));
  }
}

// ─── MODULE ─────────────────────────────────────────
@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
