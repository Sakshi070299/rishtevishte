import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma, ProfileStatus, Gender, ManglikStatus, Profession, MarriageStatus, HeightUnit } from '@prisma/client';

interface SearchFilters {
  gender?: Gender;
  manglikStatus?: ManglikStatus;
  marriageStatus?: MarriageStatus;
  profession?: Profession;
  ageMin?: number;
  ageMax?: number;
  height?: number;
  heightMin?: number;
  heightMax?: number;
  heightUnit?: HeightUnit;
  caste?: string[];
  states?: string[];
  incomeMin?: number;
  incomeMax?: number;
  disability?: boolean;
  city?: string;
  state?: string;

}

@Injectable()
export class SearchService {
  // In-memory TTL cache for weekly limit (changes ~once a month, queried every search)
  private cachedWeeklyLimit: { value: number; expiresAt: number } | null = null;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private prisma: PrismaService) { }

  // ─── GET CURRENT WEEK START (Sunday) ──────────────
  private getWeekStart(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  }

  private heightToCm(value: string | null | undefined, unit: 'CM' | 'IN' | 'FT' | null | undefined): number | null {
    if (!value) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (unit === 'IN') return n * 2.54;
    if (unit === 'FT') return n * 30.48;
    return n;
  }

  private assertSearchHeightNumber(n: number, unit: HeightUnit, label: string): void {
    if (!Number.isFinite(n)) {
      throw new BadRequestException(`${label} must be a number`);
    }
    if (unit === 'CM' && (n < 100 || n > 250)) {
      throw new BadRequestException(`${label} must be 100-250 cm`);
    }
    if (unit === 'IN' && (n < 39 || n > 98)) {
      throw new BadRequestException(`${label} must be 39-98 inches`);
    }
    if (unit === 'FT' && (n < 3 || n > 8)) {
      throw new BadRequestException(`${label} must be 3-8 ft`);
    }
  }

  // ─── GET WEEKLY LIMIT FROM SETTINGS (cached) ─────
  private async getWeeklyLimit(): Promise<number> {
    const now = Date.now();
    if (this.cachedWeeklyLimit && this.cachedWeeklyLimit.expiresAt > now) {
      return this.cachedWeeklyLimit.value;
    }

    const setting = await this.prisma.siteSettings.findUnique({
      where: { key: 'weekly_profile_limit' },
    });
    const value = setting ? parseInt(setting.value, 10) : 5;
    this.cachedWeeklyLimit = { value, expiresAt: now + SearchService.CACHE_TTL_MS };
    return value;
  }

  // ─── CHECK REMAINING VIEWS THIS WEEK ──────────────
  async getRemainingViews(userId: string) {
    const weekStart = this.getWeekStart();
    const perProfileLimit = await this.getWeeklyLimit();

    const activeProfilesCount = await this.prisma.profile.count({
      where: { userId, status: ProfileStatus.ACTIVE },
    });
    const limit = perProfileLimit * Math.max(1, activeProfilesCount);

    const viewedCount = await this.prisma.searchLog.count({
      where: { userId, weekStart },
    });

    return {
      limit,
      viewed: viewedCount,
      remaining: Math.max(0, limit - viewedCount),
      weekStart,
      weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000), // Saturday
    };
  }

  // ─── SEARCH PROFILES ──────────────────────────────
  async searchProfiles(userId: string, filters: SearchFilters) {
    // Must have at least one ACTIVE profile to search
    const activeProfiles = await this.prisma.profile.findMany({
      where: { userId, status: ProfileStatus.ACTIVE },
      select: { id: true, gender: true },
      orderBy: { createdAt: 'desc' },
      take: 2, // product cap: max two active profiles per user
    });
    if (activeProfiles.length === 0) {
      throw new ForbiddenException('Please active your profile first');
    }

    const weekStart = this.getWeekStart();
    const perProfileLimit = await this.getWeeklyLimit();
    const limit = perProfileLimit * activeProfiles.length;

    // Check weekly limit
    const viewedCount = await this.prisma.searchLog.count({
      where: { userId, weekStart },
    });
    const searchProfileSelect = {
      id: true,
      registrationNumber: true,
      status: true,
      fullName: true,
      gender: true,
      fatherName: true,
      guardianPhone: true,
      alternateMobile: true,
      guardianEmail: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      dateOfBirth: true,
      birthTime: true,
      birthPlace: true,
      height: true,
      heightUnit: true,
      weight: true,
      bloodGroup: true,
      complexion: true,
      manglikStatus: true,
      marriageStatus: true,
      childrenDetails: true,
      divorceDate: true,
      marriageDate: true,
      disability: true,
      disabilityDetails: true,
      education: true,
      profession: true,
      professionDetails: true,
      monthlyIncome: true,
      incomeType: true,
      incomeValue: true,
      fatherProfession: true,
      fatherIncome: true,
      religion: true,
      caste: true,
      glasses: true,
      glassesType: true,
      diet: true,
      healthStatus: true,
      motherName: true,
      marriedBrothers: true,
      unmarriedBrothers: true,
      marriedSisters: true,
      unmarriedSisters: true,
      house: true,
      business: true,
      otherProperty: true,
      preferredCaste: true,
      preferredAgeMin: true,
      preferredAgeMax: true,
      preferredLocation: true,
      partnerPreference: true,
      partnerPreferenceDetails: true,
      wantToSettleAbroad: true,
      photoUrl: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
    } as unknown as Prisma.ProfileSelect;

    const existingProfiles = await this.prisma.searchLog.findMany({
      where: { userId, weekStart },
      select: { profileId: true },
    });
    const viewedThisWeekIds = [...new Set(existingProfiles.map((p) => p.profileId))];
    if (viewedCount >= limit) {
      if (existingProfiles.length > 0) {
        const profileIds = existingProfiles.map(p => p.profileId);

        const profiles = await this.prisma.profile.findMany({
          where: { id: { in: profileIds } },
          select: searchProfileSelect,
        });

        return {
          profiles,
          count: profiles.length,
          remaining: 0,
          weeklyLimit: limit,
        };
      }
      // Weekly quota is exhausted, but we don't have searchable rows in search_logs for this week.
      // Don't run the normal search path (it would double-count against `remaining`).
      return {
        profiles: [],
        count: 0,
        remaining: 0,
        weeklyLimit: limit,
      };
    }

    const remaining = Math.max(0, limit - viewedCount);

    // Exclude already-viewed profiles using a subquery-style approach.
    // Bounded to last 6 months to prevent the exclusion list from growing
    // unboundedly. After 6 months, a user may see a profile again — acceptable
    // trade-off vs a NOT IN clause with 10k+ IDs.
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // const [viewedProfileIds, ownProfiles] = await Promise.all([
    //   this.prisma.searchLog.findMany({
    //     where: { userId, viewedAt: { gte: sixMonthsAgo } },
    //     select: { profileId: true },
    //     distinct: ['profileId'],
    //   }),
    //   this.prisma.profile.findMany({
    //     where: { userId },
    //     select: { id: true },
    //   }),
    // ]);

    const [ownProfiles] = await Promise.all([
      this.prisma.profile.findMany({
        where: { userId },
        select: { id: true },
      }),
    ]);
    // const excludeIds = viewedProfileIds.map((v: { profileId: string }) => v.profileId);
    const ownIds = ownProfiles.map((p: { id: string }) => p.id);
    const excludeIds = [...ownIds, ...viewedThisWeekIds];

    // // Build base query (gender decided per active profile)
    // const baseWhere: Prisma.ProfileWhereInput = {
    //   status: ProfileStatus.ACTIVE,
    //   id: { notIn: [...excludeIds, ...ownIds] },
    // };
    const baseWhere: Prisma.ProfileWhereInput = {
      status: ProfileStatus.ACTIVE,
      id: { notIn: excludeIds },
    };

    const filterHeightUnit = (filters.heightUnit ?? 'FT') as HeightUnit;
    const hasHeightRange =
      filters.heightMin !== undefined || filters.heightMax !== undefined;
    if (hasHeightRange) {
      if (filters.heightMin !== undefined) {
        this.assertSearchHeightNumber(filters.heightMin, filterHeightUnit, 'Minimum height');
      }
      if (filters.heightMax !== undefined) {
        this.assertSearchHeightNumber(filters.heightMax, filterHeightUnit, 'Maximum height');
      }
      if (
        filters.heightMin !== undefined &&
        filters.heightMax !== undefined &&
        filters.heightMin > filters.heightMax
      ) {
        throw new BadRequestException('Minimum height cannot be greater than maximum height');
      }
    } else if (filters.height !== undefined) {
      this.assertSearchHeightNumber(filters.height, filterHeightUnit, 'Height');
    }
    // const targetHeightCm = filters.height
    //   ? this.heightToCm(filters.height, filters.heightUnit ?? 'FT')
    //   : null;

    if (filters.manglikStatus) baseWhere.manglikStatus = filters.manglikStatus;
    if (filters.marriageStatus) baseWhere.marriageStatus = filters.marriageStatus;
    if (filters.profession) baseWhere.profession = filters.profession;
    if (filters.disability !== undefined) baseWhere.disability = filters.disability;
    if (filters.city) baseWhere.city = { contains: filters.city, mode: 'insensitive' };
    if (filters.states && filters.states.length > 0) {
      const cleaned = filters.states.map((s) => s.trim()).filter(Boolean);
      if (cleaned.length > 0) {
        baseWhere.OR = cleaned.map((s) => ({
          state: { equals: s, mode: 'insensitive' },
        }));
      }
    } else if (filters.state) {
      baseWhere.state = { contains: filters.state, mode: 'insensitive' };
    }

    if (filters.incomeMin || filters.incomeMax) {
      baseWhere.monthlyIncome = {};
      if (filters.incomeMin) baseWhere.monthlyIncome.gte = filters.incomeMin;
      if (filters.incomeMax) baseWhere.monthlyIncome.lte = filters.incomeMax;
    }

    // Age filter (convert to DOB range)
    if (filters.ageMin || filters.ageMax) {
      const now = new Date();
      baseWhere.dateOfBirth = {};
      if (filters.ageMax) {
        baseWhere.dateOfBirth.gte = new Date(now.getFullYear() - filters.ageMax, now.getMonth(), now.getDate());
      }
      if (filters.ageMin) {
        baseWhere.dateOfBirth.lte = new Date(now.getFullYear() - filters.ageMin, now.getMonth(), now.getDate());
      }
    }

    // Caste filter (multi-select)
    if (filters.caste && filters.caste.length > 0) {
      baseWhere.preferredCaste = { in: filters.caste };
    }



    const oppositeGender = (g: Gender): Gender => (g === Gender.GROOM ? Gender.BRIDE : Gender.GROOM);

    const toCm = (val: number, unit: HeightUnit): number => {
      if (unit === 'CM') return val;
      if (unit === 'IN') return val * 2.54;
      return val * 30.48; // FT (decimal feet, e.g. 5.8)
    };

    const heightFilterEnabled =
      filters.height !== undefined ||
      filters.heightMin !== undefined ||
      filters.heightMax !== undefined;

    const useRange = hasHeightRange;
    const requestedHeightCm =
      !useRange && filters.height !== undefined
        ? toCm(filters.height, filterHeightUnit)
        : undefined;
    const rangeMinCm =
      useRange && filters.heightMin !== undefined
        ? toCm(filters.heightMin, filterHeightUnit)
        : undefined;
    const rangeMaxCm =
      useRange && filters.heightMax !== undefined
        ? toCm(filters.heightMax, filterHeightUnit)
        : undefined;

    const EPS = 1e-6;
    const heightMatches = (p: { height: string | null; heightUnit: HeightUnit }) => {
      if (!heightFilterEnabled) return true;
      const raw = p.height?.trim();
      if (!raw) return false;
      const num = Number(raw);
      if (!Number.isFinite(num)) return false;
      const cm = toCm(num, (p.heightUnit ?? 'CM') as HeightUnit);
      if (useRange) {
        const lo = rangeMinCm ?? -Infinity;
        const hi = rangeMaxCm ?? Infinity;
        return cm >= lo - EPS && cm <= hi + EPS;
      }
      if (requestedHeightCm === undefined) return true;
      return Math.abs(cm - requestedHeightCm) <= 0.5;
    };

    const selected: Array<(typeof activeProfiles)[number] & Record<string, any>> = [];
    const selectedIds = new Set<string>();
    let remainingLeft = remaining;

    for (const own of activeProfiles) {
      if (remainingLeft <= 0) break;
      const take = Math.min(perProfileLimit, remainingLeft);
      const where = {
        ...baseWhere,
        gender: oppositeGender(own.gender),
        id: { notIn: [...excludeIds, ...Array.from(selectedIds)] },
      } as unknown as Prisma.ProfileWhereInput;

      const takeFetch = heightFilterEnabled ? Math.min(Math.max(take * 6, take), 250) : take;
      const rawChunk = await this.prisma.profile.findMany({
        where,
        take: takeFetch,
        orderBy: { createdAt: 'desc' },
        select: searchProfileSelect,
      });
      const chunk = heightFilterEnabled ? rawChunk.filter((p) => heightMatches(p as any)) : rawChunk;

      let addedThisRound = 0;
      for (const p of chunk) {
        if (addedThisRound >= take || remainingLeft <= 0) break;
        if (selectedIds.has(p.id)) continue;
        selectedIds.add(p.id);
        selected.push(p as any);
        addedThisRound += 1;
        remainingLeft -= 1;
      }
    }

    let profiles = selected;

    // If there are no *new* matches left in the DB for this query, fall back to what the user
    // already viewed this week (without consuming additional weekly quota).
    if (profiles.length === 0 && viewedThisWeekIds.length > 0) {
      profiles = await this.prisma.profile.findMany({
        where: { id: { in: viewedThisWeekIds } },
        select: searchProfileSelect,
      });
      return {
        profiles,
        count: profiles.length,
        remaining,
        weeklyLimit: limit,
      };
    }

    // Log newly viewed profiles only (deduped vs this week's logs)
    const viewedSet = new Set(viewedThisWeekIds);
    const newLogs = profiles.filter((p) => !viewedSet.has(p.id));
    if (newLogs.length > 0) {
      await this.prisma.searchLog.createMany({
        data: newLogs.map((p) => ({
          userId,
          profileId: p.id,
          weekStart,
        })),
        skipDuplicates: true,
      });
    }

    const viewedAfter = viewedCount + newLogs.length;

    return {
      profiles,
      count: profiles.length,
      remaining: Math.max(0, limit - viewedAfter),
      weeklyLimit: limit,
    };
  }
}
