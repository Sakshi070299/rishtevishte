import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import {
  Prisma,
  ProfileStatus,
  DonationType,
  PaymentStatus,
  PaymentMethod,
  RegistrationSource,
  Role,
  HeightUnit,
} from "@prisma/client";

@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private profilesService: ProfilesService,
  ) {}

  // ─── LOG ACTIVITY ─────────────────────────────────
  async logActivity(userId: string, action: string, details?: string) {
    await this.prisma.teamActivity.create({
      data: { userId, action, details },
    });
  }

  // ─── CREATE PROFILE OFFLINE (Team/Manager) ────────
  // Creates a profile on behalf of a user with optional cash/free payment.
  async createProfileOffline(
    staffUserId: string,
    profileData: Record<string, any>,
    paymentMethods: Array<"CASH" | "FREE" | "ONLINE"> = ["CASH"],
    paymentDetails?: {
      cashCollectedBy?: string;
      cashReceiptNo?: string;
      cashAmount?: number;
      onlineProvider?: string;
      onlineRefNo?: string;
      onlineAmount?: number;
      freeAmount?: number;
      freeApprovedBy?: string;
      freeReason?: string;
    },
  ) {
    const staffUser = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      select: { role: true },
    });
    const staffRole = staffUser?.role;

    const methods =
      paymentMethods && paymentMethods.length > 0 ? paymentMethods : ["CASH"];
    const hasFree = methods.includes("FREE");
    const hasCash = methods.includes("CASH");
    const hasOnline = methods.includes("ONLINE");

    if (methods.length === 0) {
      throw new BadRequestException("paymentMethods is required");
    }
    if (hasFree && (hasCash || hasOnline)) {
      throw new BadRequestException("FREE cannot be combined with CASH/ONLINE");
    }

    // If userId isn't provided (common for offline registrations),
    // resolve the owner user by guardianPhone (mobile) and create the USER if missing.
    const { userId: providedUserId, guardianPhone, ...restData } = profileData;
    let ownerUserId: string | undefined = providedUserId;

    if (!ownerUserId) {
      const mobile =
        typeof guardianPhone === "string" ? guardianPhone.trim() : "";
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        throw new BadRequestException(
          "guardianPhone is required to link the profile to a user (10-digit Indian mobile)",
        );
      }

      const existing = await this.prisma.user.findUnique({ where: { mobile } });
      if (existing) {
        ownerUserId = existing.id;
      } else {
        const created = await this.prisma.user.create({
          data: {
            mobile,
            role: Role.USER,

            // Optional: store name if present; safe to omit.
            name:
              typeof restData.fullName === "string"
                ? restData.fullName
                : undefined,
          },
        });
        ownerUserId = created.id;
      }
    }

    // Create profile via ProfilesService so registration number is generated
    // with the same sequence. We pass registrationSource and createdById through
    // the spread — ProfilesService.create() keeps unknown fields in safeData which
    // Prisma then stores via the ...safeData spread in the create call.
    // ProfilesService.create() requires `guardianPhone` in the Prisma payload.
    // We destructured guardianPhone above, so it must be re-injected here.
    const profile = await this.profilesService.create(
      ownerUserId,
      {
        ...restData,
        guardianPhone,
        registrationSource: RegistrationSource.OFFLINE,
        status: ProfileStatus.ACTIVE,
        createdById: staffUserId,
      } as Prisma.ProfileCreateInput,
      { allowMultipleForUser: true, actorRole: staffRole ?? Role.USER },
    );

    let donation: Awaited<
      ReturnType<PrismaService["donation"]["create"]>
    > | null = null;
    const REGISTRATION_FEE_RUPEES = 2100;

    if (hasFree) {
      const freeAmountRupees =
        typeof paymentDetails?.freeAmount === "number"
          ? paymentDetails.freeAmount
          : REGISTRATION_FEE_RUPEES;
      if (freeAmountRupees <= 0) {
        throw new BadRequestException("FREE payment requires freeAmount > 0");
      }

      // Generate invoice number using the same sequence as online payments
      const invoiceNumber = await this.generateInvoiceNumber();
      const amountPaisa = Math.round(freeAmountRupees * 100);

      // Create donation and activate profile in a single atomic transaction
      const [createdDonation] = await this.prisma.$transaction(async (tx) => {
        const don = await tx.donation.create({
          data: {
            userId: ownerUserId,
            profileId: profile.id,
            type: DonationType.REGISTRATION,
            amount: amountPaisa,
            paymentMethod: PaymentMethod.FREE,
            gateway: "free",
            paymentStatus: PaymentStatus.COMPLETED,
            collectedById: staffUserId,
            invoiceNumber,
            donorName: profile.fullName ?? undefined,
            donorMobile: profile.guardianPhone ?? undefined,
            splitPaymentMethods: methods,
            splitFreeRupees: freeAmountRupees,
            splitFreeApprovedBy: paymentDetails?.freeApprovedBy ?? undefined,
            splitFreeReason: paymentDetails?.freeReason ?? undefined,
          },
        });

        await tx.profile.update({
          where: { id: profile.id },
          data: { status: ProfileStatus.ACTIVE },
        });

        return [don];
      });

      donation = createdDonation;
      await this.logActivity(
        staffUserId,
        "CREATE_PROFILE_OFFLINE",
        JSON.stringify({
          profileId: profile.id,
          ownerUserId,
          paymentMethods: methods,
          invoiceNumber,
        }),
      );
    } else {
      // CASH and/or ONLINE
      if (!hasCash && !hasOnline) {
        throw new BadRequestException(
          "At least one of CASH or ONLINE must be selected",
        );
      }
      if (hasCash) {
        const cashAmountRupees =
          typeof paymentDetails?.cashAmount === "number"
            ? paymentDetails.cashAmount
            : 0;
        if (cashAmountRupees <= 0) {
          throw new BadRequestException("CASH payment requires cashAmount > 0");
        }

        const invoiceNumber = await this.generateInvoiceNumber();
        const amountPaisa = Math.round(cashAmountRupees * 100);

        const activateNow = !hasOnline; // if online portion exists, keep profile pending until online verifies

        const [createdDonation] = await this.prisma.$transaction(async (tx) => {
          const don = await tx.donation.create({
            data: {
              userId: ownerUserId,
              profileId: profile.id,
              type: DonationType.REGISTRATION,
              amount: amountPaisa,
              paymentMethod: PaymentMethod.CASH,
              gateway: "cash",
              paymentStatus: PaymentStatus.COMPLETED,
              collectedById: staffUserId,
              invoiceNumber,
              donorName: profile.fullName ?? undefined,
              donorMobile: profile.guardianPhone ?? undefined,
              splitPaymentMethods: methods,
              splitCashRupees: cashAmountRupees,
              splitOnlineRupees: hasOnline
                ? paymentDetails?.onlineAmount
                : undefined,
            },
          });

          if (activateNow) {
            await tx.profile.update({
              where: { id: profile.id },
              data: { status: ProfileStatus.ACTIVE },
            });
          }

          return [don];
        });

        donation = createdDonation;
        await this.logActivity(
          staffUserId,
          "CREATE_PROFILE_OFFLINE",
          JSON.stringify({
            profileId: profile.id,
            ownerUserId,
            paymentMethods: methods,
            invoiceNumber,
          }),
        );
      }

      if (hasOnline) {
        if (
          typeof paymentDetails?.onlineAmount !== "number" ||
          paymentDetails.onlineAmount <= 0
        ) {
          throw new BadRequestException(
            "ONLINE payment requires onlineAmount > 0",
          );
        }
        await this.logActivity(
          staffUserId,
          "CREATE_PROFILE_OFFLINE",
          JSON.stringify({
            profileId: profile.id,
            ownerUserId,
            paymentMethods: methods,
            onlinePortion: paymentDetails?.onlineAmount ?? null,
          }),
        );
      }
    }

    const finalProfile = await this.prisma.profile.findUnique({
      where: { id: profile.id },
    });

    return {
      profile: finalProfile,
      donation: donation ?? null,
      paymentMethods: methods,
      message: hasOnline
        ? "Profile created — awaiting online payment"
        : "Profile activated",
    };
  }

  // ─── INVOICE NUMBER (mirrors DonationsService private method) ──
  // Duplicated here so TeamsService does not depend on DonationsService internals.
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seqName = `invoice_seq_${year}`;
    await this.prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1`,
    );
    const result = await this.prisma.$queryRawUnsafe<[{ nextval: bigint }]>(
      `SELECT nextval('"${seqName}"')`,
    );
    const num = Number(result[0].nextval);
    return `INV-${year}-${num.toString().padStart(4, "0")}`;
  }

  // ─── SEARCH PROFILES (Team has full access) ───────
  async searchProfiles(
    userId: string,
    filters: {
      name?: string;
      mobile?: string;
      registrationNumber?: string;
      registrationDate?: string;
      status?: string;
      gender?: string;
      search?: string;
      page?: number | string;
      limit?: number | string;
      sortUpdatedAt?: 'asc' | 'desc';
      datePreset?: 'all' | 'today' | 'weekly' | 'monthly' | 'custom';
      dateFrom?: string;
      dateTo?: string;
      registrationSource?: string;
      manglik?: 'MANGLIK' | 'NON_MANGLIK' | 'ANSHIK_MANGLIK';
      disability?: 'YES' | 'NO';
      ageMin?: string;
      ageMax?: string;
      heightUnit?: "CM" | "IN" | "FT";
      heightMin?: string;
      heightMax?: string;
      marriage?: string;
      sort?: string;
    },
  ) {
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const allowInternalReference =
      requester?.role === Role.TEAM || requester?.role === Role.ADMIN;

    await this.logActivity(userId, "SEARCH", JSON.stringify(filters));

    const mappedSortUpdatedAt =
      filters.sortUpdatedAt ??
      (filters.sort === 'OLDEST' ? 'asc' : filters.sort === 'LATEST' ? 'desc' : undefined);

    const parseOptNum = (v: string | undefined): number | undefined => {
      if (v === undefined || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    return this.profilesService.findAll({
      search:
        filters.search ||
        filters.name ||
        filters.mobile ||
        filters.registrationNumber,
      status: filters.status as ProfileStatus | undefined,
      gender: filters.gender,
      page:
        typeof filters.page === "string" ? Number(filters.page) : filters.page,
      limit:
        typeof filters.limit === "string"
          ? Number(filters.limit)
          : filters.limit,
      allowInternalReference,
      sortUpdatedAt: filters.sortUpdatedAt,
      datePreset: filters.datePreset,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      registrationSource: filters.registrationSource,
      manglik: filters.manglik,
      disability: filters.disability,
      ageMin: typeof filters.ageMin === 'string' ? Number(filters.ageMin) : undefined,
      ageMax: typeof filters.ageMax === 'string' ? Number(filters.ageMax) : undefined,
      heightUnit: filters.heightUnit as HeightUnit | undefined,
      heightMin: parseOptNum(filters.heightMin),
      heightMax: parseOptNum(filters.heightMax),
      marriage: filters.marriage,
      sort: filters.sort,
    });
  }

  // ─── EDIT PROFILE (Team override) ─────────────────
  async editProfile(
    userId: string,
    profileId: string,
    data: Prisma.ProfileUpdateInput,
  ) {
    const profile = await this.profilesService.findOne(profileId);
    const updated = await this.profilesService.update(
      profileId,
      profile.userId,
      "TEAM",
      data,
    );
    await this.logActivity(userId, "EDIT_PROFILE", `Profile: ${profileId}`);
    return updated;
  }

  // ─── MARK SETTLED / UNSETTLED ─────────────────────
  async toggleSettled(userId: string, profileId: string, settled: boolean) {
    const action = settled ? "MARK_SETTLED" : "MARK_UNSETTLED";
    await this.logActivity(userId, action, `Profile: ${profileId}`);

    if (settled) {
      return this.profilesService.markSettled(profileId, userId, "TEAM");
    }
    return this.profilesService.markUnsettled(profileId);
  }

  // ─── UPDATE PROFILE STATUS (Team/Manager/Admin) ───
  async updateProfileStatus(userId: string, profileId: string, status: ProfileStatus) {
    const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new BadRequestException("Profile not found");

    const data: Prisma.ProfileUpdateInput = { status };
    // If a team member activates a previously unpaid online self-registration,
    // treat it as an OFFLINE registration for reporting accuracy.
    if (
      profile.status === ProfileStatus.PENDING_PAYMENT &&
      (status === ProfileStatus.ACTIVE || status === ProfileStatus.SETTLED) &&
      profile.registrationSource === RegistrationSource.ONLINE
    ) {
      data.registrationSource = RegistrationSource.OFFLINE;
    }
    if (status === ProfileStatus.SETTLED) {
      data.settledAt = new Date();
    } else {
      data.settledAt = null;
    }

    const updated = await this.prisma.profile.update({ where: { id: profileId }, data });
    await this.logActivity(userId, "UPDATE_STATUS", `Profile: ${profileId}, Status: ${status}`);
    return updated;
  }

  // ─── EXPORT PROFILES (limit-based preview/export) ─
  async exportBatch(userId: string, limit: number = 25) {
    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(Math.floor(limit), 100))
      : 25;
    await this.logActivity(userId, "EXPORT", `Limit: ${safeLimit}`);

    const where: Prisma.ProfileWhereInput = {
      status: { in: ["PENDING_PAYMENT", "ACTIVE", "SETTLED"] },
    };

    const [profiles, total] = await Promise.all([
      this.prisma.profile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: safeLimit,
      }),
      this.prisma.profile.count({ where }),
    ]);

    return {
      profiles,
      batch: 1,
      batchSize: profiles.length,
      total,
      totalBatches: 1,
      limit: safeLimit,
    };
  }

  // ─── TEAM DASHBOARD STATS ────────────────────────
  async getDashboardStats(userId: string) {
    const [
      totalProfiles,
      activeProfiles,
      settledProfiles,
      pendingProfiles,
      recentActivities,
    ] = await Promise.all([
      this.prisma.profile.count(),
      this.prisma.profile.count({ where: { status: "ACTIVE" } }),
      this.prisma.profile.count({ where: { status: "SETTLED" } }),
      this.prisma.profile.count({ where: { status: "PENDING_PAYMENT" } }),
      this.prisma.teamActivity.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      profiles: {
        total: totalProfiles,
        active: activeProfiles,
        settled: settledProfiles,
        pending: pendingProfiles,
      },
      myActions: recentActivities.length,
      recentActivities,
    };
  }

  // ─── MY ACTIVITY LOG ───────────────────────────────
  async getMyActivity(userId: string, days: number = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.prisma.teamActivity.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  // ─── PRINT REGISTRATIONS (Last 2 weeks only) ─────
  async getPrintableRegistrations(
    userId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const from = dateFrom ? new Date(dateFrom) : twoWeeksAgo;
    const to = dateTo ? new Date(dateTo) : new Date();
    to.setHours(23, 59, 59, 999);

    if (from < twoWeeksAgo) {
      throw new ForbiddenException(
        "Can only print registrations from the last 2 weeks",
      );
    }

    await this.logActivity(
      userId,
      "PRINT",
      `From: ${from.toISOString()} To: ${to.toISOString()}`,
    );

    return this.prisma.profile.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
    });
  }

  async listIncompleteUsers(
    filters: {
      search?: string;
      page?: number | string;
      limit?: number | string;
    },
  ) {
    const [activityIds, creatorIds, collectorIds] = await Promise.all([
      this.prisma.teamActivity.findMany({
        select: { userId: true },
        distinct: ["userId"],
      }),
      this.prisma.profile.findMany({
        where: { createdById: { not: null } },
        select: { createdById: true },
        distinct: ["createdById"],
      }),
      this.prisma.donation.findMany({
        where: { collectedById: { not: null } },
        select: { collectedById: true },
        distinct: ["collectedById"],
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
        { name: { contains: filters.search, mode: "insensitive" } },
        { mobile: { contains: filters.search } },
      ];
    }

    const pageRaw =
      typeof filters.page === "string" ? Number(filters.page) : filters.page;
    const limitRaw =
      typeof filters.limit === "string" ? Number(filters.limit) : filters.limit;
    const page = Number.isFinite(pageRaw) && pageRaw && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw && limitRaw > 0 ? limitRaw : 20;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
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

    return { data, total, page, totalPages: Math.ceil(total / limit), limit };
  }
}
