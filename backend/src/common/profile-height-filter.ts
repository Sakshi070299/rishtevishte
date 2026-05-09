import { BadRequestException } from '@nestjs/common';
import { HeightUnit, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

const EPS = 1e-6;

function toCm(val: number, unit: HeightUnit): number {
  if (unit === 'CM') return val;
  if (unit === 'IN') return val * 2.54;
  return val * 30.48;
}

export function assertPanelHeightNumber(n: number, unit: HeightUnit, label: string): void {
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

export function validateHeightRangeQuery(args: {
  heightUnit?: HeightUnit;
  heightMin?: number;
  heightMax?: number;
}): void {
  const filterUnit = (args.heightUnit ?? 'FT') as HeightUnit;
  const hasRange = args.heightMin !== undefined || args.heightMax !== undefined;
  if (!hasRange) return;

  if (args.heightMin !== undefined) {
    assertPanelHeightNumber(args.heightMin, filterUnit, 'Minimum height');
  }
  if (args.heightMax !== undefined) {
    assertPanelHeightNumber(args.heightMax, filterUnit, 'Maximum height');
  }
  if (
    args.heightMin !== undefined &&
    args.heightMax !== undefined &&
    args.heightMin > args.heightMax
  ) {
    throw new BadRequestException('Minimum height cannot be greater than maximum height');
  }
}

export function profileMatchesHeightRangeCm(
  p: { height: string | null; heightUnit: HeightUnit },
  filterUnit: HeightUnit,
  heightMin?: number,
  heightMax?: number,
): boolean {
  const rangeMinCm = heightMin !== undefined ? toCm(heightMin, filterUnit) : undefined;
  const rangeMaxCm = heightMax !== undefined ? toCm(heightMax, filterUnit) : undefined;
  const raw = p.height?.trim();
  if (!raw) return false;
  const num = Number(raw);
  if (!Number.isFinite(num)) return false;
  const cm = toCm(num, (p.heightUnit ?? 'CM') as HeightUnit);
  const lo = rangeMinCm ?? -Infinity;
  const hi = rangeMaxCm ?? Infinity;
  return cm >= lo - EPS && cm <= hi + EPS;
}

export function heightRangeFilterEnabled(heightMin?: number, heightMax?: number): boolean {
  return heightMin !== undefined || heightMax !== undefined;
}

/**
 * Walks the DB in `orderBy` order and returns profile ids whose height falls in the range
 * (filter unit vs stored profile unit resolved via cm), preserving list order for pagination.
 */
export async function collectProfileIdsMatchingHeightRange(
  prisma: PrismaService,
  args: {
    where: Prisma.ProfileWhereInput;
    orderBy: Prisma.ProfileOrderByWithRelationInput | Prisma.ProfileOrderByWithRelationInput[];
    filterUnit: HeightUnit;
    heightMin?: number;
    heightMax?: number;
    batchSize?: number;
  },
): Promise<string[]> {
  const { where, orderBy, filterUnit, heightMin, heightMax } = args;
  const batchSize = args.batchSize ?? 400;
  const ids: string[] = [];
  let skip = 0;
  for (;;) {
    const rows = await prisma.profile.findMany({
      where,
      orderBy,
      skip,
      take: batchSize,
      select: { id: true, height: true, heightUnit: true },
    });
    for (const r of rows) {
      if (profileMatchesHeightRangeCm(r, filterUnit, heightMin, heightMax)) {
        ids.push(r.id);
      }
    }
    if (rows.length < batchSize) break;
    skip += batchSize;
  }
  return ids;
}
