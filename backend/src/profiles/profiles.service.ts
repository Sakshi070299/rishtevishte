import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { archivedProfileCreateManySafe } from "../common/archived-profile-archive";
import { PrismaService } from "../common/prisma.service";
import { applyMaskIfLocked, loadViewerAccess } from "../common/profile-access";
import { Prisma, ProfileStatus, Gender, Role, RegistrationSource, PaymentStatus, DonationType,ManglikStatus, MarriageStatus, HeightUnit } from "@prisma/client";
import {
  collectProfileIdsMatchingHeightRange,
  heightRangeFilterEnabled,
  validateHeightRangeQuery,
} from "../common/profile-height-filter";

// ─── PROFILE STATUS STATE MACHINE ───────────────────
// Single source of truth for valid transitions.
// Every status change must go through this — no raw updates.
const VALID_TRANSITIONS: Record<ProfileStatus, ProfileStatus[]> = {
  PENDING_PAYMENT: [ProfileStatus.ACTIVE, ProfileStatus.INACTIVE],
  ACTIVE: [ProfileStatus.SETTLED, ProfileStatus.INACTIVE],
  SETTLED: [ProfileStatus.ACTIVE], // unsettled by TEAM/ADMIN only
  INACTIVE: [ProfileStatus.ACTIVE],
};

function assertTransition(from: ProfileStatus, to: ProfileStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new ForbiddenException(`Invalid status transition: ${from} → ${to}`);
  }
}

/** Only these roles are capped at one profile on self-service `POST /profiles`. TEAM / MANAGER / ADMIN are not limited here; offline staff flow uses `allowMultipleForUser`. */
const ROLES_SINGLE_PROFILE_CAP: readonly Role[] = [Role.USER];

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) { }

  // ─── GENERATE REGISTRATION NUMBER ─────────────────
  // Format: RS-2026-001
  // Uses PostgreSQL sequence for race-free atomic increment.
  private async generateRegNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seqName = `reg_seq_${year}`;

    // Create sequence if it doesn't exist for this year.
    // IF NOT EXISTS is safe to call concurrently.
    await this.prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1`,
    );

    const result = await this.prisma.$queryRawUnsafe<[{ nextval: bigint }]>(
      `SELECT nextval('"${seqName}"')`,
    );
    const nextNum = Number(result[0].nextval);

    return `RS-${year}-${nextNum.toString().padStart(3, "0")}`;
  }

  // ─── PROFILE COMPLETION % ─────────────────────────
  calculateCompletionPct(data: Record<string, unknown>): number {
    const hasValue = (value: unknown): boolean => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string") return value.trim() !== "";
      return true;
    };

    // Completion is based on product-approved profile fields list.
    const completionFields = [
      "fatherName",
      "fatherProfession",
      "fatherIncome",
      "alternateMobile",
      "guardianEmail",
      "address",
      "city",
      "state",
      "pincode",
      "religion",
      "caste",
      "gender",
      "fullName",
      "marriageStatus",
      "birthTime",
      "birthPlace",
      "height",
      "weight",
      "bloodGroup",
      "complexion",
      "manglikStatus",
      "education",
      "profession",
      "monthlyIncome",
      "incomeType",
      "incomeValue",
      "diet",
      "healthStatus",
      "glasses",
      "glassesType",
      "motherName",
      "house",
      "otherProperty",
      "partnerPreference",
      "partnerPreferenceDetails",
    ];

    const filled = completionFields.filter((f) => hasValue(data[f])).length;
    return Math.round((filled / completionFields.length) * 100);
  }

  // ─── CREATE PROFILE ───────────────────────────────
  async create(
    userId: string,
    data: Prisma.ProfileCreateInput & { userId?: string },
    options?: { allowMultipleForUser?: boolean; actorRole?: Role },
  ) {
    const actorRole = options?.actorRole ?? Role.USER;

    // Guardrail: a single guardian phone can have max 2 profiles.
    // Backend-only enforcement so UI doesn't need special casing.
    // (Admins can override by editing data directly if ever needed.)
    const incomingPhone =
      typeof (data as Record<string, unknown>).guardianPhone === "string"
        ? ((data as Record<string, unknown>).guardianPhone as string).trim()
        : "";
    if (incomingPhone && actorRole !== Role.ADMIN) {
      const existingForPhone = await this.prisma.profile.count({
        where: { guardianPhone: incomingPhone },
      });
      if (existingForPhone >= 2) {
        throw new ConflictException(
          "This mobile number already has 2 profiles created. You cannot create any more profiles."
        );
      }
    }

    if (!options?.allowMultipleForUser) {
      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (
        owner &&
        ROLES_SINGLE_PROFILE_CAP.includes(owner.role)
      ) {
        const count = await this.prisma.profile.count({ where: { userId } });
        if (count >= 1) {
          throw new ConflictException(
            "A profile already exists for this account. You cannot create another profile.",
          );
        }
      }
    }

    // Prevent callers from accidentally mixing `userId` with `user.connect`,
    // which makes Prisma's create input types incompatible.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userId: _ignoredUserId, user: _ignoredUser, ...safeData } = data;

    // Internal registration reference is restricted to TEAM/ADMIN only.
    if (actorRole !== Role.TEAM && actorRole !== Role.ADMIN) {
      delete (safeData as Record<string, unknown>).internalRegistrationNo;
    }

    // Never store base64 data URLs — they bloat the database.
    if (typeof safeData.photoUrl === 'string' && safeData.photoUrl.startsWith('data:')) {
      delete safeData.photoUrl;
    }

    const registrationNumber = await this.generateRegNumber();

    // Auto-expire after 6 months.
    // If caller provided a createdAt (e.g., offline backdated registration),
    // compute expiry from that date to keep validity window consistent.
    const createdAt =
      safeData.createdAt instanceof Date
        ? safeData.createdAt
        : typeof safeData.createdAt === 'string'
          ? new Date(safeData.createdAt)
          : undefined;

    const base = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : new Date();
    const expiresAt = new Date(base);
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    const completionPct = this.calculateCompletionPct(safeData as Record<string, unknown>);
    console.log('userId', userId);

    return this.prisma.profile.create({
      data: {
        ...safeData,
        registrationNumber,
        user: { connect: { id: userId } },
        status: safeData.status || ProfileStatus.PENDING_PAYMENT,
        expiresAt,
        completionPct,
      },
    });
  }


  // ─── GET USER'S PROFILES ──────────────────────────
  async findByUser(userId: string) {
    const profiles = await this.prisma.profile.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return profiles.map((p) => {
      const { internalRegistrationNo: _hidden, ...safe } = p as any;
      return safe;
    });
  }

  // ─── GET SINGLE PROFILE ───────────────────────────
  async findOne(id: string, userId?: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException("Profile not found");
    if (userId && profile.userId !== userId)
      throw new ForbiddenException("Not your profile");
    if (userId) {
      const { internalRegistrationNo: _hidden, ...safe } = profile as any;
      return safe;
    }
    return profile;
  }

  /**
   * Read a profile through the access gate.
   * - Owner / STAFF / paid USERs see the full profile.
   * - Other USERs see only name + age + father/mother name + occupation + caste
   *   (other fields are nulled and `_locked: true` is set on the response).
   */
  async findOneForViewer(id: string, viewerUserId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException("Profile not found");

    const viewer = await loadViewerAccess(this.prisma, viewerUserId);
    const { internalRegistrationNo: _hidden, ...safe } = profile as any;
    return applyMaskIfLocked(safe, viewer);
  }

  // ─── UPDATE PROFILE ───────────────────────────────
  async update(
    id: string,
    userId: string,
    role: string,
    data: Prisma.ProfileUpdateInput,
  ) {
    const enforceOwnership = role === "USER";
    const profile = await this.findOne(id, enforceOwnership ? userId : undefined);
    if (profile.status === ProfileStatus.SETTLED) {
      throw new ForbiddenException("Cannot edit a settled profile");
    }

    // Extra guard: even if controller forgot to strip, never allow regular users to change
    // system-controlled fields.
    const safeData = { ...(data as unknown as Record<string, unknown>) };
    if (role === "USER") {
      const forbiddenForUser = [
        "status",
        "settledAt",
        "settledBy",
        "registrationNumber",
        "userId",
        "user",
        "id",
        "createdAt",
        "updatedAt",
      ];
      for (const key of forbiddenForUser) delete safeData[key];
    }

    if (role !== "TEAM" && role !== "ADMIN") {
      delete safeData.internalRegistrationNo;
    }

    // Only staff roles may override registration date (`createdAt`).
    // Keep it enforced on server even if UI changes.
    if (safeData.createdAt != null) {
      const canEditRegistrationDate =
        role === "TEAM" || role === "MANAGER" || role === "ADMIN";
      if (!canEditRegistrationDate) {
        delete safeData.createdAt;
      } else {
        const raw = safeData.createdAt;
        const ca = raw instanceof Date ? raw : new Date(raw as string);
        if (!Number.isNaN(ca.getTime())) {
          const expiresAt = new Date(ca);
          expiresAt.setMonth(expiresAt.getMonth() + 6);
          (safeData as Record<string, unknown>).expiresAt = expiresAt;
        }
      }
    }

    // Never store base64 data URLs — they bloat the database.
    if (typeof safeData.photoUrl === 'string' && (safeData.photoUrl as string).startsWith('data:')) {
      delete safeData.photoUrl;
    }

    // Recalculate completion percentage on every update — reuse already-fetched profile.
    const currentProfile = profile;
    const merged = {
      ...(currentProfile as Record<string, unknown>),
      ...(safeData as Record<string, unknown>),
    };
    const completionPct = this.calculateCompletionPct(merged);

    // Cast via unknown so the language server (which may lag behind prisma generate)
    // does not flag completionPct — tsc --noEmit confirms this is valid.
    const updateData = {
      ...(safeData as Prisma.ProfileUpdateInput),
      completionPct,
    } as unknown as Prisma.ProfileUpdateInput;
    return this.prisma.profile.update({
      where: { id },
      data: updateData,
    });
  }

  // ─── MARK AS SETTLED ──────────────────────────────
  async markSettled(id: string, settledBy: string, role: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!profile) throw new NotFoundException("Profile not found");

    if (role === "USER" && profile.userId !== settledBy) {
      throw new ForbiddenException("Not your profile");
    }

    assertTransition(profile.status, ProfileStatus.SETTLED);

    return this.prisma.profile.update({
      where: { id },
      data: {
        status: ProfileStatus.SETTLED,
        settledAt: new Date(),
        settledBy,
      },
    });
  }

  // ─── MARK AS UNSETTLED (Team/Admin only) ──────────
  async markUnsettled(id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!profile) throw new NotFoundException("Profile not found");

    assertTransition(profile.status, ProfileStatus.ACTIVE);

    return this.prisma.profile.update({
      where: { id },
      data: {
        status: ProfileStatus.ACTIVE,
        settledAt: null,
        settledBy: null,
      },
    });
  }

  // ─── ACTIVATE AFTER PAYMENT ───────────────────────
  async activateProfile(id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!profile) throw new NotFoundException("Profile not found");

    assertTransition(profile.status, ProfileStatus.ACTIVE);

    return this.prisma.profile.update({
      where: { id },
      data: { status: ProfileStatus.ACTIVE },
    });
  }

  // ─── ADMIN: GET ALL PROFILES ──────────────────────
  async findAll(filters?: {
    status?: ProfileStatus;
    gender?: string;
    search?: string;
    createdById?: string;
    registrationSource?: string;
    datePreset?: "all" | "today" | "weekly" | "monthly" | "custom";
    /** YYYY-MM-DD */
    dateFrom?: string;
    /** YYYY-MM-DD */
    dateTo?: string;
    manglik?: "MANGLIK" | "NON_MANGLIK" | "ANSHIK_MANGLIK";
    disability?: "YES" | "NO";
    ageMin?: number;
    ageMax?: number;
    /** Comma-separated: SINGLE,DIVORCED,WIDOWED */
    marriage?: string;
    /** LATEST | OLDEST | AGE_ASC | AGE_DESC */
    sort?: string;
    page?: number;
    limit?: number;
    allowInternalReference?: boolean;
    /** List sort order (currently by createdAt). */
    sortUpdatedAt?: "asc" | "desc";
    heightUnit?: HeightUnit;
    heightMin?: number;
    heightMax?: number;
  }) {
    const where: Prisma.ProfileWhereInput = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.gender) where.gender = filters.gender as Gender;
    if (filters?.createdById) where.createdById = filters.createdById;
    if (filters?.registrationSource) {
      where.registrationSource = filters.registrationSource as RegistrationSource;
    }
    if (filters?.search) {
      const q = filters.search;
      const matchAlternateMobile = {
        alternateMobile: { contains: q },
      } as unknown as Prisma.ProfileWhereInput;
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { registrationNumber: { contains: q, mode: "insensitive" } },
        ...(filters?.allowInternalReference
          ? [{ internalRegistrationNo: { contains: q, mode: "insensitive" } } as Prisma.ProfileWhereInput]
          : []),
        { guardianPhone: { contains: q } },
        matchAlternateMobile,
      ];
    }

    // Date filter on createdAt
    if (filters?.datePreset && filters.datePreset !== "all") {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      if (filters.datePreset === "today") {
        where.createdAt = { gte: startOfToday, lte: endOfToday };
      } else if (filters.datePreset === "weekly") {
        const since = new Date(startOfToday);
        since.setDate(since.getDate() - 6);
        where.createdAt = { gte: since, lte: endOfToday };
      } else if (filters.datePreset === "monthly") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        where.createdAt = { gte: startOfMonth, lte: endOfToday };
      } else if (filters.datePreset === "custom") {
        const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000Z`) : null;
        const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999Z`) : null;
        const createdAt: Prisma.DateTimeFilter = {};
        if (from && !Number.isNaN(from.getTime())) createdAt.gte = from;
        if (to && !Number.isNaN(to.getTime())) createdAt.lte = to;
        if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;
      }
    }

    // Manglik (MANGLIK / NON_MANGLIK / ANSHIK_MANGLIK)
    if (filters?.manglik === "MANGLIK") where.manglikStatus = ManglikStatus.MANGLIK;
    if (filters?.manglik === "NON_MANGLIK") where.manglikStatus = ManglikStatus.NON_MANGLIK;
    if (filters?.manglik === "ANSHIK_MANGLIK") where.manglikStatus = ManglikStatus.ANSHIK_MANGLIK;

    // Disability YES/NO
    if (filters?.disability === "YES") where.disability = true;
    if (filters?.disability === "NO") where.disability = false;

    // Marriage status (SINGLE/DIVORCED/WIDOWED/WIDOWER)
    if (filters?.marriage) {
      const parts = filters.marriage
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const mapped: MarriageStatus[] = [];
      for (const p of parts) {
        if (p === "SINGLE") mapped.push(MarriageStatus.UNMARRIED);
        if (p === "DIVORCED") mapped.push(MarriageStatus.DIVORCEE);
        if (p === "WIDOWED") mapped.push(MarriageStatus.WIDOW, MarriageStatus.WIDOWER);
        if (p === "WIDOWER") mapped.push(MarriageStatus.WIDOWER);
      }
      const uniq = Array.from(new Set(mapped));
      if (uniq.length > 0) where.marriageStatus = { in: uniq };
    }

    // Age range (convert to DOB range)
    if (filters?.ageMin || filters?.ageMax) {
      const now = new Date();
      where.dateOfBirth = {};
      if (filters.ageMax) {
        where.dateOfBirth.gte = new Date(now.getFullYear() - filters.ageMax, now.getMonth(), now.getDate());
      }
      if (filters.ageMin) {
        where.dateOfBirth.lte = new Date(now.getFullYear() - filters.ageMin, now.getMonth(), now.getDate());
      }
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const orderBy = (() => {
      if (filters?.sort === "OLDEST") return { createdAt: "asc" as const };
      if (filters?.sort === "AGE_ASC") return { dateOfBirth: "desc" as const };
      if (filters?.sort === "AGE_DESC") return { dateOfBirth: "asc" as const };
      if (filters?.sortUpdatedAt) return { createdAt: filters.sortUpdatedAt };
      return { createdAt: "desc" as const };
    })();

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const whereNoReg: Prisma.ProfileWhereInput = { ...where };
    delete (whereNoReg as any).registrationSource;

    const filterUnit = (filters?.heightUnit ?? "FT") as HeightUnit;
    const hMin = filters?.heightMin;
    const hMax = filters?.heightMax;
    const useHeight = heightRangeFilterEnabled(hMin, hMax);
    if (useHeight) {
      validateHeightRangeQuery({ heightUnit: filterUnit, heightMin: hMin, heightMax: hMax });
    }

    let data: Prisma.ProfileGetPayload<object>[];
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
          ? await this.prisma.profile.findMany({ where: { id: { in: pageIds } } })
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
        }),
        this.prisma.profile.count({ where }),
        this.prisma.profile.count({ where: { ...where, createdAt: { gte: startOfToday, lte: endOfToday } } }),
        this.prisma.profile.count({ where: { ...whereNoReg, registrationSource: RegistrationSource.ONLINE } }),
        this.prisma.profile.count({ where: { ...whereNoReg, registrationSource: RegistrationSource.OFFLINE } }),
      ]);
    }

    const safeData = filters?.allowInternalReference
      ? data
      : data.map((p) => {
        const { internalRegistrationNo: _hidden, ...safe } = p as any;
        return safe;
      });

    return {
      data: safeData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      counts: {
        total,
        today: todayTotal,
        online: onlineCount,
        offline: offlineCount,
      },
    };
  }

  // ─── EXPIRE STALE PROFILES (scheduled) ───────────
  async expireStaleProfiles() {
    // Cast via unknown: language server may lag behind prisma generate;
    // tsc --noEmit confirms expiresAt is a valid ProfileWhereInput field.
    const where = {
      status: ProfileStatus.ACTIVE,
      expiresAt: { lt: new Date() },
    } as unknown as Prisma.ProfileWhereInput;
    return this.prisma.profile.updateMany({
      where,
      data: { status: ProfileStatus.INACTIVE },
    });
  }

  // ─── DELETE UNPAID SELF-REGISTRATION PROFILES (scheduled) ───────────
  // Requirement: if a user self-registers (ONLINE) and doesn't pay within 15 minutes,
  // delete the unpaid profile(s). Do NOT delete the user account.
  async deleteUnpaidSelfRegistrationsOlderThan(minutes: number) {
    const cutoff = new Date(Date.now() - minutes * 60_000);

    const stalePending = await this.prisma.profile.findMany({
      where: {
        status: ProfileStatus.PENDING_PAYMENT,
        createdAt: { lt: cutoff },
        registrationSource: RegistrationSource.ONLINE,
        createdById: null,
        user: { role: Role.USER },
      },
      select: { id: true, userId: true },
    });

    if (stalePending.length === 0) return { deletedProfiles: 0 };

    const byUser = new Map<string, string[]>();
    for (const p of stalePending) {
      const arr = byUser.get(p.userId) ?? [];
      arr.push(p.id);
      byUser.set(p.userId, arr);
    }

    let deletedProfiles = 0;

    for (const [userId, profileIds] of byUser.entries()) {
      // If any registration payment succeeded, never delete these profiles.
      const completedRegPayment = await this.prisma.donation.count({
        where: {
          userId,
          type: DonationType.REGISTRATION,
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });
      if (completedRegPayment > 0) continue;

      await this.prisma.$transaction(async (tx) => {
        const profilesToArchive = await tx.profile.findMany({
          where: { id: { in: profileIds } },
          include: { donations: true },
        });

        if (profilesToArchive.length > 0) {
          await archivedProfileCreateManySafe(
            tx,
            profilesToArchive.map((p) => ({
              originalProfileId: p.id,
              userId,
              reason: "PENDING_PAYMENT_TIMEOUT",
              data: { profile: p, donations: p.donations },
            })),
            "deleteUnpaidSelfRegistrationsOlderThan",
          );
        }

        // Remove linked donations first (FK constraints).
        await tx.donation.deleteMany({
          where: {
            OR: [
              { userId },
              { profileId: { in: profileIds } },
            ],
          },
        });

        const profRes = await tx.profile.deleteMany({ where: { id: { in: profileIds } } });

        deletedProfiles += profRes.count;
      });
    }

    return { deletedProfiles };
  }

  // ─── EXPIRE CURRENT USER IF PAYMENT WINDOW PASSED ───────────
  // Called from UI when countdown hits 0 to make deletion immediate.
  async expireMyPendingPaymentIfPastWindow(userId: string, minutes: number) {
    const cutoff = new Date(Date.now() - minutes * 60_000);

    const pending = await this.prisma.profile.findMany({
      where: {
        userId,
        status: ProfileStatus.PENDING_PAYMENT,
        createdAt: { lt: cutoff },
        registrationSource: RegistrationSource.ONLINE,
        createdById: null,
        user: { role: Role.USER },
      },
      select: { id: true },
    });

    if (pending.length === 0) return { expired: false };

    const profileIds = pending.map((p) => p.id);

    // Safety: if any completed reg payment exists, never delete.
    const completedRegPayment = await this.prisma.donation.count({
      where: { userId, type: DonationType.REGISTRATION, paymentStatus: PaymentStatus.COMPLETED },
    });
    if (completedRegPayment > 0) return { expired: false };

    await this.prisma.$transaction(async (tx) => {
      const profilesToArchive = await tx.profile.findMany({
        where: { id: { in: profileIds } },
        include: { donations: true },
      });

      if (profilesToArchive.length > 0) {
        await archivedProfileCreateManySafe(
          tx,
          profilesToArchive.map((p) => ({
            originalProfileId: p.id,
            userId,
            reason: "PENDING_PAYMENT_TIMEOUT",
            data: { profile: p, donations: p.donations },
          })),
          "expireMyPendingPaymentIfPastWindow",
        );
      }

      await tx.donation.deleteMany({
        where: {
          OR: [
            { userId },
            { profileId: { in: profileIds } },
          ],
        },
      });
      await tx.profile.deleteMany({ where: { id: { in: profileIds } } });
    });

    return { expired: true };
  }

  // ─── DEACTIVATE PROFILE (owner only) ─────────────
  async deactivateProfile(id: string, userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException("Profile not found");
    if (profile.userId !== userId)
      throw new ForbiddenException("Not your profile");

    return this.prisma.profile.update({
      where: { id },
      data: { status: ProfileStatus.INACTIVE },
    });
  }

  // ─── DATA EXPORT (DPDP compliance) ────────────────
  // Returns all user data in a portable JSON format.
  async exportUserData(userId: string) {
    const [user, profiles, donations, searchLogs] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          mobile: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      this.prisma.profile.findMany({
        where: { userId },
      }),
      this.prisma.donation.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          amount: true,
          currency: true,
          paymentStatus: true,
          donorName: true,
          donorMobile: true,
          createdAt: true,
        },
      }),
      this.prisma.searchLog.count({ where: { userId } }),
    ]);

    const safeProfiles = profiles.map((p) => {
      const { internalRegistrationNo: _hidden, ...safe } = p as any;
      return safe;
    });

    return {
      exportedAt: new Date().toISOString(),
      user,
      profiles: safeProfiles,
      donations,
      searchActivity: { totalProfilesViewed: searchLogs },
    };
  }
}
