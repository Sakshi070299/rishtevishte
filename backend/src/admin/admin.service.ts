import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import {
  archivedProfileCreateManySafe,
  archivedProfileCreateSafe,
} from '../common/archived-profile-archive';
import { PrismaService } from '../common/prisma.service';
import { Prisma, ProfileStatus, Gender, Role, RegistrationSource, PaymentMethod, ManglikStatus, MarriageStatus, HeightUnit } from '@prisma/client';
import {
  collectProfileIdsMatchingHeightRange,
  heightRangeFilterEnabled,
  validateHeightRangeQuery,
} from '../common/profile-height-filter';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private async hardDeleteStaffUser(id: string, expectedRole: Role) {
    const member = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!member || member.role !== expectedRole) {
      throw new NotFoundException(
        expectedRole === Role.MANAGER ? 'Manager not found' : 'Team member not found',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const ownedProfiles = await tx.profile.findMany({
        where: { userId: id },
        include: { donations: true },
      });
      const ownedProfileIds = ownedProfiles.map((p) => p.id);

      if (ownedProfileIds.length > 0) {
        await archivedProfileCreateManySafe(
          tx,
          ownedProfiles.map((p) => ({
            originalProfileId: p.id,
            userId: id,
            reason: `ADMIN_DELETE_STAFF_${expectedRole}_OWNED_PROFILE`,
            data: { profile: p, donations: p.donations },
          })),
          `hardDeleteStaffUser:${expectedRole}`,
        );

        // Search logs reference viewed profile IDs; clean to avoid stale references.
        await tx.searchLog.deleteMany({
          where: { profileId: { in: ownedProfileIds } },
        });

        await tx.donation.deleteMany({
          where: { profileId: { in: ownedProfileIds } },
        });

        await tx.profile.deleteMany({
          where: { id: { in: ownedProfileIds } },
        });
      }

      await tx.donation.deleteMany({ where: { userId: id } });
      await tx.searchLog.deleteMany({ where: { userId: id } });
      await tx.teamActivity.deleteMany({ where: { userId: id } });
      await tx.session.deleteMany({ where: { userId: id } });

      // Scalar references used for reporting/audit should be nulled.
      await tx.profile.updateMany({
        where: { createdById: id },
        data: { createdById: null },
      });
      await tx.donation.updateMany({
        where: { collectedById: id },
        data: { collectedById: null },
      });

      await tx.user.delete({ where: { id } });
    });

    return { success: true, deletedUserId: id };
  }

  // ═══ TEAM MANAGEMENT ══════════════════════════════
  // Team members are Users with role=TEAM in the unified User table.

  async listTeamMembers() {
    return this.prisma.user.findMany({
      where: { role: 'TEAM' },
      orderBy: { createdAt: 'desc' },
      include: { teamActivities: { take: 5, orderBy: { createdAt: 'desc' } } },
    });
  }

  async addTeamMember(name: string, mobile: string) {
    // Check if mobile already exists as any role
    const existing = await this.prisma.user.findUnique({ where: { mobile } });
    if (existing) {
      if(existing.role === 'ADMIN') {
        throw new ConflictException('Mobile already registered as admin');
      }
      if(existing.role === 'MANAGER') {
        throw new ConflictException('Mobile already registered as manager');
      }
      if(existing.role === 'USER') {
        throw new ConflictException('Mobile already registered as user');
      }
      if (existing.role === 'TEAM') {
        throw new ConflictException('Mobile already registered as team member');
      }
      // Upgrade existing USER to TEAM role
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { name, role: 'TEAM', isActive: true },
      });
    }

    return this.prisma.user.create({
      data: { name, mobile, role: 'TEAM' },
    });
  }

  async removeTeamMember(id: string) {
    return this.hardDeleteStaffUser(id, Role.TEAM);
  }

  // ═══ SITE SETTINGS ════════════════════════════════

  async getSettings() {
    return this.prisma.siteSettings.findMany();
  }

  async updateSetting(key: string, value: string, label?: string) {
    return this.prisma.siteSettings.upsert({
      where: { key },
      update: { value, ...(label && { label }) },
      create: { key, value, label: label || key },
    });
  }

  async updateWeeklyLimit(limit: number) {
    return this.updateSetting('weekly_profile_limit', limit.toString(), 'Weekly Profile View Limit');
  }

  // ═══ GALLERY MANAGEMENT ═══════════════════════════

  async getGalleryImages() {
    return this.prisma.galleryImage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addGalleryImage(title: string, titleHi: string, imageUrl: string) {
    const maxOrder = await this.prisma.galleryImage.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.prisma.galleryImage.create({
      data: {
        title,
        titleHi,
        imageUrl,
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
      },
    });
  }

  async deleteGalleryImage(id: string) {
    return this.prisma.galleryImage.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ═══ BANNER MANAGEMENT ════════════════════════════

  async listBanners() {
    return this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addBanner(title: string, titleHi: string | undefined, imageUrl: string, linkUrl?: string) {
    const maxOrder = await this.prisma.banner.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.prisma.banner.create({
      data: {
        title,
        ...(titleHi && { titleHi }),
        imageUrl,
        ...(linkUrl && { linkUrl }),
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
      },
    });
  }

  async deleteBanner(id: string) {
    return this.prisma.banner.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ═══ MANAGER MANAGEMENT ═══════════════════════════

  async listManagers() {
    return this.prisma.user.findMany({
      where: { role: Role.MANAGER },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, mobile: true, name: true, role: true,
        isActive: true, lastLoginAt: true, createdAt: true,
      },
    });
  }

  async addManager(name: string, mobile: string) {
    const existing = await this.prisma.user.findUnique({ where: { mobile } });
    if (existing) {
      if (existing.role === Role.MANAGER) {
        throw new ConflictException('Mobile already registered as manager');
      }
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { name, role: Role.MANAGER, isActive: true },
      });
    }

    return this.prisma.user.create({
      data: { name, mobile, role: Role.MANAGER },
    });
  }

  async removeManager(id: string) {
    return this.hardDeleteStaffUser(id, Role.MANAGER);
  }

  // ═══ TEAM ACTIVITY TRACKING ═══════════════════════

  async getTeamActivity(userId?: string, days: number = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const where: { createdAt: { gte: Date }; userId?: string } = { createdAt: { gte: since } };
    if (userId) where.userId = userId;

    return this.prisma.teamActivity.findMany({
      where,
      include: { user: { select: { name: true, mobile: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ═══ ADMIN PROFILES MANAGEMENT ═════════════════════

  async listProfiles(filters: {
    search?: string;
    status?: string;
    gender?: string;
    createdById?: string;
    registrationSource?: string;
    datePreset?: string;
    dateFrom?: string;
    dateTo?: string;
    manglik?: string;
    disability?: string;
    ageMin?: string;
    ageMax?: string;
    marriage?: string;
    sort?: string;
    sortUpdatedAt?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    heightUnit?: string;
    heightMin?: string;
    heightMax?: string;
  }) {
    const where: Prisma.ProfileWhereInput = {};
    if (filters.status) where.status = filters.status as ProfileStatus;
    if (filters.gender) where.gender = filters.gender as Gender;
    if (filters.createdById) where.createdById = filters.createdById;
    if (filters.registrationSource) {
      where.registrationSource = filters.registrationSource as RegistrationSource;
    }
    if (filters.search) {
      const q = filters.search;
      const matchAlternateMobile = {
        alternateMobile: { contains: q },
      } as unknown as Prisma.ProfileWhereInput;
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { registrationNumber: { contains: q, mode: 'insensitive' } },
        { internalRegistrationNo: { contains: q, mode: 'insensitive' } },
        { guardianPhone: { contains: q } },
        matchAlternateMobile,
        { fatherName: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Date filter
    if (filters.datePreset) {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      if (filters.datePreset === 'today') {
        where.createdAt = { gte: startOfToday, lte: endOfToday };
      } else if (filters.datePreset === 'weekly') {
        const since = new Date(startOfToday);
        since.setDate(since.getDate() - 6);
        where.createdAt = { gte: since, lte: endOfToday };
      } else if (filters.datePreset === 'monthly') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        where.createdAt = { gte: startOfMonth, lte: endOfToday };
      } else if (filters.datePreset === 'custom') {
        const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000Z`) : null;
        const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999Z`) : null;
        const createdAt: Prisma.DateTimeFilter = {};
        if (from && !Number.isNaN(from.getTime())) createdAt.gte = from;
        if (to && !Number.isNaN(to.getTime())) createdAt.lte = to;
        if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;
      }
    }

    // Manglik (MANGLIK / NON_MANGLIK / ANSHIK_MANGLIK)
    if (filters.manglik === 'MANGLIK') where.manglikStatus = ManglikStatus.MANGLIK;
    if (filters.manglik === 'NON_MANGLIK') where.manglikStatus = ManglikStatus.NON_MANGLIK;
    if (filters.manglik === 'ANSHIK_MANGLIK') where.manglikStatus = ManglikStatus.ANSHIK_MANGLIK;

    // Disability YES/NO
    if (filters.disability === 'YES') where.disability = true;
    if (filters.disability === 'NO') where.disability = false;

    // Marriage: SINGLE,DIVORCED,WIDOWED,WIDOWER
    if (filters.marriage) {
      const parts = filters.marriage
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const mapped: MarriageStatus[] = [];
      for (const p of parts) {
        if (p === 'SINGLE') mapped.push(MarriageStatus.UNMARRIED);
        if (p === 'DIVORCED') mapped.push(MarriageStatus.DIVORCEE);
        if (p === 'WIDOWED') mapped.push(MarriageStatus.WIDOW, MarriageStatus.WIDOWER);
        if (p === 'WIDOWER') mapped.push(MarriageStatus.WIDOWER);
      }
      const uniq = Array.from(new Set(mapped));
      if (uniq.length > 0) where.marriageStatus = { in: uniq };
    }

    // Age range -> DOB range
    const ageMinNum = filters.ageMin ? Number(filters.ageMin) : undefined;
    const ageMaxNum = filters.ageMax ? Number(filters.ageMax) : undefined;
    if (ageMinNum || ageMaxNum) {
      const now = new Date();
      where.dateOfBirth = {};
      if (ageMaxNum) {
        where.dateOfBirth.gte = new Date(now.getFullYear() - ageMaxNum, now.getMonth(), now.getDate());
      }
      if (ageMinNum) {
        where.dateOfBirth.lte = new Date(now.getFullYear() - ageMinNum, now.getMonth(), now.getDate());
      }
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;

    const orderBy = (() => {
      if (filters.sort === 'OLDEST') return { createdAt: 'asc' as const };
      if (filters.sort === 'AGE_ASC') return { dateOfBirth: 'desc' as const };
      if (filters.sort === 'AGE_DESC') return { dateOfBirth: 'asc' as const };
      if (filters.sortUpdatedAt) return { createdAt: filters.sortUpdatedAt };
      return { createdAt: 'desc' as const };
    })();

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const whereNoReg: Prisma.ProfileWhereInput = { ...where };
    delete (whereNoReg as any).registrationSource;

    const parseHeightNum = (v: string | undefined): number | undefined => {
      if (v === undefined || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const hMin = parseHeightNum(filters.heightMin);
    const hMax = parseHeightNum(filters.heightMax);
    const huRaw = filters.heightUnit?.trim()?.toUpperCase();
    const filterUnit =
      huRaw === 'CM' || huRaw === 'IN' || huRaw === 'FT' ? (huRaw as HeightUnit) : ('FT' as HeightUnit);
    const useHeight = heightRangeFilterEnabled(hMin, hMax);
    if (useHeight) {
      validateHeightRangeQuery({ heightUnit: filterUnit, heightMin: hMin, heightMax: hMax });
    }

    let data: Array<
      Prisma.ProfileGetPayload<{ include: { user: { select: { mobile: true; name: true } } } }>
    >;
    let total: number;
    let todayTotal: number;
    let onlineCount: number;
    let offlineCount: number;

    if (useHeight) {
      const orderedIds = await collectProfileIdsMatchingHeightRange(this.prisma, {
        where,
        orderBy,
        filterUnit,
        heightMin: hMin,
        heightMax: hMax,
      });
      total = orderedIds.length;
      const pageIds = orderedIds.slice((page - 1) * limit, page * limit);
      const rows =
        pageIds.length > 0
          ? await this.prisma.profile.findMany({
              where: { id: { in: pageIds } },
              include: { user: { select: { mobile: true, name: true } } },
            })
          : [];
      const orderIndex = new Map(pageIds.map((id, i) => [id, i]));
      rows.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));
      data = rows;

      if (orderedIds.length === 0) {
        todayTotal = 0;
        onlineCount = 0;
        offlineCount = 0;
      } else {
        [todayTotal, onlineCount, offlineCount] = await Promise.all([
          this.prisma.profile.count({
            where: {
              AND: [
                { id: { in: orderedIds } },
                { createdAt: { gte: startOfToday, lte: endOfToday } },
              ],
            },
          }),
          this.prisma.profile.count({
            where: {
              AND: [{ id: { in: orderedIds } }, whereNoReg, { registrationSource: RegistrationSource.ONLINE }],
            },
          }),
          this.prisma.profile.count({
            where: {
              AND: [{ id: { in: orderedIds } }, whereNoReg, { registrationSource: RegistrationSource.OFFLINE }],
            },
          }),
        ]);
      }
    } else {
      [data, total, todayTotal, onlineCount, offlineCount] = await Promise.all([
        this.prisma.profile.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: { user: { select: { mobile: true, name: true } } },
        }),
        this.prisma.profile.count({ where }),
        this.prisma.profile.count({ where: { ...where, createdAt: { gte: startOfToday, lte: endOfToday } } }),
        this.prisma.profile.count({ where: { ...whereNoReg, registrationSource: RegistrationSource.ONLINE } }),
        this.prisma.profile.count({ where: { ...whereNoReg, registrationSource: RegistrationSource.OFFLINE } }),
      ]);
    }

    // Resolve createdById → staff name/role for profiles created by team/manager
    const creatorIds = [...new Set(data.map((p) => p.createdById).filter(Boolean))] as string[];
    const creatorsMap: Record<string, { name: string | null; role: string }> = {};
    if (creatorIds.length > 0) {
      const creators = await this.prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true, role: true },
      });
      for (const c of creators) {
        creatorsMap[c.id] = { name: c.name, role: c.role };
      }
    }

    const enriched = data.map((p) => ({
      ...p,
      createdBy: p.createdById ? creatorsMap[p.createdById] || null : null,
    }));

    return {
      data: enriched,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      counts: {
        total,
        today: todayTotal,
        online: onlineCount,
        offline: offlineCount,
      },
    };
  }

  async updateProfileStatus(profileId: string, status: ProfileStatus) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Profile not found');

    const data: Prisma.ProfileUpdateInput = { status };
    if (status === 'SETTLED') {
      data.settledAt = new Date();
    }

    return this.prisma.profile.update({ where: { id: profileId }, data });
  }

  async deleteProfile(profileId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Profile not found');
    await this.prisma.$transaction(async (tx) => {
      const ownerUserId = profile.userId;

      const profileToArchive = await tx.profile.findUnique({
        where: { id: profileId },
        include: { donations: true },
      });
      if (profileToArchive) {
        await archivedProfileCreateSafe(
          tx,
          {
            originalProfileId: profileId,
            userId: ownerUserId,
            reason: 'ADMIN_DELETE_PROFILE',
            data: { profile: profileToArchive, donations: profileToArchive.donations },
          },
          'deleteProfile',
        );
      }

      await tx.searchLog.deleteMany({ where: { profileId } });
      await tx.donation.deleteMany({ where: { profileId } });
      await tx.profile.delete({ where: { id: profileId } });

      const owner = await tx.user.findUnique({
        where: { id: ownerUserId },
        select: { id: true, role: true },
      });
      if (!owner || owner.role !== Role.USER) return;

      const remainingProfiles = await tx.profile.count({
        where: { userId: ownerUserId },
      });
      if (remainingProfiles > 0) return;

      // No profile left for this end-user: remove the user and dependent data too.
      await tx.donation.deleteMany({ where: { userId: ownerUserId } });
      await tx.searchLog.deleteMany({ where: { userId: ownerUserId } });
      await tx.teamActivity.deleteMany({ where: { userId: ownerUserId } });
      await tx.session.deleteMany({ where: { userId: ownerUserId } });
      await tx.user.delete({ where: { id: ownerUserId } });
    });
    return { success: true, deletedProfileId: profileId };
  }

  // ═══ ADMIN DONATIONS MANAGEMENT ════════════════════

  async listDonations(filters: {
    type?: string;
    status?: string;
    search?: string;
    paymentMethod?: string;
    collectedById?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.DonationWhereInput = {};
    if (filters.type) where.type = filters.type as 'REGISTRATION' | 'GENERAL';
    if (filters.status) where.paymentStatus = filters.status as 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
    if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod as PaymentMethod;
    if (filters.collectedById) where.collectedById = filters.collectedById;
    if (filters.search) {
      where.OR = [
        { donorName: { contains: filters.search, mode: 'insensitive' } },
        { donorMobile: { contains: filters.search } },
        { gatewayOrderId: { contains: filters.search } },
        { gatewayPaymentId: { contains: filters.search } },
        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
        { splitFreeApprovedBy: { contains: filters.search, mode: 'insensitive' } },
        { splitFreeReason: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;

    const [data, total, completedRows] = await Promise.all([
      this.prisma.donation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          profile: { select: { fullName: true, registrationNumber: true } },
          user: { select: { mobile: true, name: true } },
        },
      }),
      this.prisma.donation.count({ where }),
      this.prisma.donation.findMany({
        where: { ...where, paymentStatus: 'COMPLETED' },
        select: {
          amount: true,
          paymentMethod: true,
          splitCashRupees: true,
          splitOnlineRupees: true,
        },
      }),
    ]);

    let onlineRupees = 0;
    let offlineRupees = 0;
    for (const d of completedRows) {
      const splitOnline = d.splitOnlineRupees ?? 0;
      const splitCash = d.splitCashRupees ?? 0;
      const hasSplit = splitOnline > 0 || splitCash > 0;
      if (hasSplit) {
        onlineRupees += splitOnline;
        offlineRupees += splitCash;
        continue;
      }
      const amountRupees = (d.amount ?? 0) / 100;
      if (d.paymentMethod === 'ONLINE') onlineRupees += amountRupees;
      else if (d.paymentMethod === 'CASH') offlineRupees += amountRupees;
    }

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      summary: {
        onlineRupees,
        offlineRupees,
        combinedRupees: onlineRupees + offlineRupees,
      },
    };
  }

  // ═══ REGISTRATION REPORT ═══════════════════════════
  // Groups profiles by source, createdBy, and payment method.
  // Designed for "how many cash registrations did Ram Sewak do this month?" queries.

  async getRegistrationReport(filters: {
    period?: string;             // 'today' | 'week' | 'month' | 'year'
    createdById?: string;        // filter to a specific team/manager user ID
    registrationSource?: string; // 'ONLINE' | 'OFFLINE'
    paymentMethod?: string;      // 'ONLINE' | 'CASH' | 'FREE'
    collectedById?: string;      // team/manager who collected cash (donation-side filter)
  }) {
    // ── Build the time window
    const now = new Date();
    let since: Date | undefined;
    switch (filters.period) {
      case 'today':
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        since = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        since = new Date(now.getFullYear(), 0, 1);
        break;
    }

    // ── Profile-side where clause
    const profileWhere: Prisma.ProfileWhereInput = {};
    if (since) profileWhere.createdAt = { gte: since };
    if (filters.createdById) profileWhere.createdById = filters.createdById;
    if (filters.registrationSource) {
      profileWhere.registrationSource = filters.registrationSource as RegistrationSource;
    }

    // ── Donation-side where clause (for payment method filter)
    const donationWhere: Prisma.DonationWhereInput = {
      type: 'REGISTRATION',
      paymentStatus: 'COMPLETED',
    };
    if (since) donationWhere.createdAt = { gte: since };
    if (filters.paymentMethod) donationWhere.paymentMethod = filters.paymentMethod as PaymentMethod;
    if (filters.collectedById) donationWhere.collectedById = filters.collectedById;

    // ── Parallel queries
    const [
      totalProfiles,
      onlineProfiles,
      offlineProfiles,
      totalDonations,
      cashDonations,
      freeDonations,
      onlineDonations,
      byCreator,
    ] = await Promise.all([
      this.prisma.profile.count({ where: profileWhere }),
      this.prisma.profile.count({ where: { ...profileWhere, registrationSource: 'ONLINE' } }),
      this.prisma.profile.count({ where: { ...profileWhere, registrationSource: 'OFFLINE' } }),
      this.prisma.donation.aggregate({
        where: donationWhere,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.donation.aggregate({
        where: { ...donationWhere, paymentMethod: 'CASH' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.donation.aggregate({
        where: { ...donationWhere, paymentMethod: 'FREE' },
        _count: true,
      }),
      this.prisma.donation.aggregate({
        where: { ...donationWhere, paymentMethod: 'ONLINE' },
        _sum: { amount: true },
        _count: true,
      }),
      // Group by createdById — raw aggregation via groupBy
      this.prisma.profile.groupBy({
        by: ['createdById'],
        where: profileWhere,
        _count: { id: true },
      }),
    ]);

    // ── Resolve creator names in a single follow-up query
    const creatorIds = byCreator
      .map((r) => r.createdById)
      .filter((id): id is string => id !== null);

    const creators = creatorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, mobile: true, role: true },
        })
      : [];

    const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u]));

    const byCreatorResolved = byCreator.map((row) => ({
      createdById: row.createdById,
      createdBy: row.createdById ? (creatorMap[row.createdById] ?? null) : null,
      count: row._count.id,
    }));

    return {
      period: filters.period ?? 'all',
      since: since?.toISOString() ?? null,
      filters: {
        createdById: filters.createdById ?? null,
        registrationSource: filters.registrationSource ?? null,
        paymentMethod: filters.paymentMethod ?? null,
      },
      profiles: {
        total: totalProfiles,
        bySource: { online: onlineProfiles, offline: offlineProfiles },
        byCreator: byCreatorResolved,
      },
      collections: {
        total: { count: totalDonations._count, amount: (totalDonations._sum.amount ?? 0) / 100 },
        cash:   { count: cashDonations._count,   amount: (cashDonations._sum.amount   ?? 0) / 100 },
        free:   { count: freeDonations._count },
        online: { count: onlineDonations._count, amount: (onlineDonations._sum.amount ?? 0) / 100 },
      },
    };
  }

  // ═══ NOTIFICATION HISTORY ══════════════════════════

  async listNotifications(filters: {
    channel?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.NotificationWhereInput = {};
    if (filters.channel) where.channel = filters.channel as 'SMS' | 'WHATSAPP' | 'EMAIL';
    if (filters.status) where.status = filters.status as 'PENDING' | 'SENT' | 'FAILED';

    const page = filters.page || 1;
    const limit = filters.limit || 30;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ═══ USERS OVERVIEW ════════════════════════════════

  async listUsers(filters: {
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.UserWhereInput = {};
    if (filters.role) where.role = filters.role as 'USER' | 'TEAM' | 'ADMIN';
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { mobile: { contains: filters.search } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, mobile: true, name: true, role: true,
          isActive: true, lastLoginAt: true, createdAt: true,
          _count: { select: { profiles: true, donations: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async listIncompleteUsers(filters: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const [activityIds, creatorIds, collectorIds] = await Promise.all([
      this.prisma.teamActivity.findMany({
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.profile.findMany({
        where: { createdById: { not: null } },
        select: { createdById: true },
        distinct: ['createdById'],
      }),
      this.prisma.donation.findMany({
        where: { collectedById: { not: null } },
        select: { collectedById: true },
        distinct: ['collectedById'],
      }),
    ]);

    const staffLikeIds = Array.from(
      new Set([
        ...activityIds.map((x) => x.userId),
        ...creatorIds.map((x) => x.createdById).filter((v): v is string => !!v),
        ...collectorIds.map((x) => x.collectedById).filter((v): v is string => !!v),
      ]),
    );

    const where: Prisma.UserWhereInput = {
      role: Role.USER,
      profiles: { none: {} },
      teamActivities: { none: {} },
      ...(staffLikeIds.length > 0 ? { id: { notIn: staffLikeIds } } : {}),
    };
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { mobile: { contains: filters.search } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          mobile: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { profiles: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }
}
