import type { HeightUnit } from "@/types";

/** Same formula as backend search: FT/IN stored as decimal total (e.g. 5.8 ft). */
export function heightToCm(value: number, unit: HeightUnit): number {
  if (unit === "CM") return value;
  if (unit === "IN") return value * 2.54;
  return value * 30.48;
}

export const HEIGHT_INPUT_BOUNDS: Record<
  HeightUnit,
  { min: number; max: number; label: string }
> = {
  FT: { min: 3, max: 8, label: "ft" },
  IN: { min: 39, max: 98, label: "in" },
  CM: { min: 100, max: 250, label: "cm" },
};

export function isHeightInBounds(n: number, unit: HeightUnit): boolean {
  const { min, max } = HEIGHT_INPUT_BOUNDS[unit];
  return n >= min && n <= max;
}

/** Returns error message or null if OK. */
export function validateHeightRangeFilter(
  unit: HeightUnit,
  heightMin?: number,
  heightMax?: number,
): string | null {
  const { min, max, label } = HEIGHT_INPUT_BOUNDS[unit];
  if (heightMin !== undefined) {
    if (!Number.isFinite(heightMin)) return "Minimum height is invalid.";
    if (heightMin < min || heightMin > max) {
      return `Minimum height must be between ${min}–${max} ${label}.`;
    }
  }
  if (heightMax !== undefined) {
    if (!Number.isFinite(heightMax)) return "Maximum height is invalid.";
    if (heightMax < min || heightMax > max) {
      return `Maximum height must be between ${min}–${max} ${label}.`;
    }
  }
  if (
    heightMin !== undefined &&
    heightMax !== undefined &&
    heightMin > heightMax
  ) {
    return "Minimum height cannot be greater than maximum height.";
  }
  return null;
}
