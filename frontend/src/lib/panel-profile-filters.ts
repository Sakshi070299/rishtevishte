export type DatePreset = "all" | "today" | "weekly" | "monthly" | "custom";
export type RegistrationType = "ONLINE" | "OFFLINE";
export type TriState = "ALL" | "YES" | "NO";
export type ManglikFilter = "ALL" | "MANGLIK" | "NON_MANGLIK" | "ANSHIK_MANGLIK";
export type MarriageFilter = "SINGLE" | "DIVORCED" | "WIDOWED" | "WIDOWER";
export type SortOption = "LATEST" | "OLDEST" | "AGE_ASC" | "AGE_DESC";

export type PanelHeightUnit = "CM" | "IN" | "FT";

export type PanelProfileFilters = {
  datePreset: DatePreset;
  /** YYYY-MM-DD */
  dateFrom?: string;
  /** YYYY-MM-DD */
  dateTo?: string;

  registrationType?: RegistrationType; // ONLINE/OFFLINE
  manglik: ManglikFilter;
  disability: TriState;
  ageMin?: number;
  ageMax?: number;
  /** Min/max height in heightUnit (same rules as public search). */
  heightUnit?: PanelHeightUnit;
  heightMin?: number;
  heightMax?: number;
  marriage: MarriageFilter[]; // multi-select
};

export const DEFAULT_PANEL_PROFILE_FILTERS: PanelProfileFilters = {
  datePreset: "all",
  manglik: "ALL",
  disability: "ALL",
  marriage: [],
};

export function buildPanelProfilesQuery(filters: PanelProfileFilters, sort: SortOption) {
  const parts: string[] = [];

  parts.push(`datePreset=${filters.datePreset}`);
  if (filters.datePreset === "custom") {
    if (filters.dateFrom) {
      const from = filters.dateFrom;
      const to = filters.dateTo || filters.dateFrom; // allow single-date custom
      parts.push(`dateFrom=${encodeURIComponent(from)}`);
      parts.push(`dateTo=${encodeURIComponent(to)}`);
    }
  }

  if (filters.registrationType) parts.push(`registrationSource=${filters.registrationType}`);
  if (filters.manglik !== "ALL") parts.push(`manglik=${filters.manglik}`);
  if (filters.disability !== "ALL") parts.push(`disability=${filters.disability}`);
  if (filters.ageMin !== undefined) parts.push(`ageMin=${filters.ageMin}`);
  if (filters.ageMax !== undefined) parts.push(`ageMax=${filters.ageMax}`);
  const hasHeightRange =
    filters.heightMin !== undefined || filters.heightMax !== undefined;
  if (hasHeightRange) {
    parts.push(`heightUnit=${filters.heightUnit ?? "FT"}`);
    if (filters.heightMin !== undefined) parts.push(`heightMin=${filters.heightMin}`);
    if (filters.heightMax !== undefined) parts.push(`heightMax=${filters.heightMax}`);
  }
  if (filters.marriage.length) parts.push(`marriage=${encodeURIComponent(filters.marriage.join(","))}`);

  parts.push(`sort=${sort}`);

  return parts;
}

