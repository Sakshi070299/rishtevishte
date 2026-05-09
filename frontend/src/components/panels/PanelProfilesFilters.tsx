"use client";

import { X } from "lucide-react";
import {
  DEFAULT_PANEL_PROFILE_FILTERS,
  type MarriageFilter,
  type PanelProfileFilters,
  type SortOption,
} from "@/lib/panel-profile-filters";
import type { HeightUnit } from "@/types";
import { heightToCm, validateHeightRangeFilter } from "@/lib/height-convert";

export type PanelProfilesExtraStaff = {
  id: string;
  name: string | null;
  role: string;
};

export type PanelProfilesExtraFilters = {
  statusValue: string;
  onStatusChange: (value: string) => void;
  statusOptions: { value: string; label: string }[];
  genderValue: string;
  onGenderChange: (value: string) => void;
  genderOptions: { value: string; label: string }[];
  creator?: {
    value: string;
    onChange: (value: string) => void;
    staff: PanelProfilesExtraStaff[];
  };
};

type Props = {
  value: PanelProfileFilters;
  sort: SortOption;
  onChange: (next: PanelProfileFilters) => void;
  onSortChange: (next: SortOption) => void;
  onClear?: () => void;
  /** Status / gender / optional creator — rendered as grid cells (no nested grid). */
  extraFilters?: PanelProfilesExtraFilters;
  /** If true, show Clear even when only outer filters changed */
  isDirty?: boolean;
};

const MARRIAGE_OPTIONS: Array<{ id: MarriageFilter; label: string }> = [
  { id: "SINGLE", label: "Unmarried" },
  { id: "DIVORCED", label: "Divorced" },
  { id: "WIDOWED", label: "Widowed" },
  { id: "WIDOWER", label: "Widower" },
];

function chip(label: string, onRemove: () => void) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#E8D5C4] bg-[#FFF7F0] px-2 py-1 text-xs font-medium text-temple-brown">
      {label}
      <button
        type="button"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/5"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
      >
        <X size={12} />
      </button>
    </span>
  );
}

export function PanelProfilesFilters({
  value,
  sort,
  onChange,
  onSortChange,
  onClear,
  extraFilters,
  isDirty,
}: Props) {
  const hasAny =
    value.datePreset !== DEFAULT_PANEL_PROFILE_FILTERS.datePreset ||
    Boolean(value.dateFrom) ||
    Boolean(value.dateTo) ||
    Boolean(value.registrationType) ||
    value.manglik !== "ALL" ||
    value.disability !== "ALL" ||
    value.ageMin !== undefined ||
    value.ageMax !== undefined ||
    value.heightMin !== undefined ||
    value.heightMax !== undefined ||
    value.marriage.length > 0 ||
    sort !== "LATEST";
  const showClear = Boolean(isDirty) || hasAny;

  return (
    <div className="bg-white rounded-xl border border-[#E8D5C4] shadow-sm p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-temple-brown">Filters</h3>
          <p className="text-[11px] text-temple-brown-light">
            Track registrations and profiles
          </p>
        </div>
        {/* {showClear && (
          <button
            type="button"
            className="text-lg font-semibold text-primary hover:underline"
            onClick={onClear}
          >
            Clear
          </button>
        )} */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {extraFilters && (
          <>
            <div>
              <label className="block text-xs font-medium text-temple-brown-light mb-1">
                Status
              </label>
              <select
                className="input-field"
                value={extraFilters.statusValue}
                onChange={(e) =>
                  extraFilters.onStatusChange(e.target.value)
                }
                aria-label="Filter by status"
              >
                {extraFilters.statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-temple-brown-light mb-1">
                Gender
              </label>
              <select
                className="input-field"
                value={extraFilters.genderValue}
                onChange={(e) =>
                  extraFilters.onGenderChange(e.target.value)
                }
                aria-label="Filter by gender"
              >
                {extraFilters.genderOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {extraFilters.creator ? (
              <div>
                <label className="block text-xs font-medium text-temple-brown-light mb-1">
                  Creator
                </label>
                <select
                  className="input-field"
                  value={extraFilters.creator.value}
                  onChange={(e) =>
                    extraFilters.creator?.onChange(e.target.value)
                  }
                  aria-label="Filter by creator"
                >
                  <option value="ALL">All Creators</option>
                  {extraFilters.creator?.staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.id.slice(0, 8)} ({s.role})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </>
        )}
        <div>
          <label className="block text-xs font-medium text-temple-brown-light mb-1">
            Date
          </label>
          <select
            className="input-field"
            value={value.datePreset}
            onChange={(e) => {
              const preset = e.target
                .value as PanelProfileFilters["datePreset"];
              onChange({
                ...value,
                datePreset: preset,
                ...(preset === "custom"
                  ? {}
                  : { dateFrom: undefined, dateTo: undefined }),
              });
            }}
          >
            <option value="all">All</option>
            <option value="today">Today</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        {value.datePreset === "custom" && (
          <div className="">
            <label className="block text-xs font-medium text-temple-brown-light mb-1">
              Custom Date
            </label>
            <input
              type="date"
              className="input-field"
              value={value.dateFrom || ""}
              onChange={(e) => {
                const d = e.target.value || undefined;
                // Single-date custom filter: apply to that exact day
                onChange({ ...value, dateFrom: d, dateTo: d });
              }}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-temple-brown-light mb-1">
            Registration Type
          </label>
          <select
            className="input-field"
            value={value.registrationType || ""}
            onChange={(e) =>
              onChange({
                ...value,
                registrationType: (e.target.value || undefined) as any,
              })
            }
          >
            <option value="">All</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-temple-brown-light mb-1">
            Sorting
          </label>
          <select
            className="input-field"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
          >
            <option value="LATEST">Latest first</option>
            <option value="OLDEST">Oldest first</option>
            <option value="AGE_ASC">Age ascending</option>
            <option value="AGE_DESC">Age descending</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-temple-brown-light mb-1">
            Manglik
          </label>
          <select
            className="input-field"
            value={value.manglik}
            onChange={(e) =>
              onChange({ ...value, manglik: e.target.value as any })
            }
          >
            <option value="ALL">All</option>
            <option value="MANGLIK">Manglik</option>
            <option value="NON_MANGLIK">Non Manglik</option>
            <option value="ANSHIK_MANGLIK">Anshik Manglik</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-temple-brown-light mb-1">
            Disability
          </label>
          <select
            className="input-field"
            value={value.disability}
            onChange={(e) =>
              onChange({ ...value, disability: e.target.value as any })
            }
          >
            <option value="ALL">All</option>
            <option value="YES">Yes</option>
            <option value="NO">No</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-temple-brown-light mb-1">
            Age range
          </label>
          <div className="flex items-center gap-2 border border-[#E8D5C4] rounded-lg">
            <input
              type="number"
              className="input-field border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent"
              placeholder="Min"
              value={value.ageMin ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  ageMin: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
            <span className="text-temple-brown-light select-none">-</span>
            <input
              type="number"
              className="input-field border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent"
              placeholder="Max"
              value={value.ageMax ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  ageMax: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>

        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-xs font-medium text-temple-brown-light mb-1">
            Height range (min – max){" "}
            <span className="font-hindi text-primary">ऊँचाई</span>
          </label>
          <div className="flex flex-wrap items-center gap-2 border border-[#E8D5C4] rounded-lg px-0.5">
            <input
              type="number"
              step="0.1"
              className="input-field min-w-[5rem] flex-1 border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent"
              placeholder={
                value.heightUnit === "CM"
                  ? "Min cm"
                  : value.heightUnit === "IN"
                    ? "Min in"
                    : "Min e.g. 5.1"
              }
              value={value.heightMin ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  heightMin: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              aria-label="Minimum height"
            />
            <span className="text-temple-brown-light select-none">–</span>
            <input
              type="number"
              step="0.1"
              className="input-field min-w-[5rem] flex-1 border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent"
              placeholder={
                value.heightUnit === "CM"
                  ? "Max cm"
                  : value.heightUnit === "IN"
                    ? "Max in"
                    : "Max e.g. 5.5"
              }
              value={value.heightMax ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  heightMax: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              aria-label="Maximum height"
            />
            <select
              className="h-[33px] shrink-0 rounded-lg border border-[#E8D5C4] bg-white px-2 text-xs font-semibold text-temple-brown focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={value.heightUnit || "FT"}
              onChange={(e) =>
                onChange({
                  ...value,
                  heightUnit: e.target.value as HeightUnit,
                  heightMin: undefined,
                  heightMax: undefined,
                })
              }
              aria-label="Height unit"
            >
              <option value="FT">FT</option>
              <option value="IN">IN</option>
              <option value="CM">CM</option>
            </select>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-temple-brown/55">
            {value.heightMin != null &&
              value.heightMax != null &&
              Number.isFinite(value.heightMin) &&
              Number.isFinite(value.heightMax) &&
              !validateHeightRangeFilter(
                (value.heightUnit || "FT") as HeightUnit,
                value.heightMin,
                value.heightMax,
              )}
          </p>
        </div>

        <div className="md:col-span-2 xl:col-span-1">
          <label className="block text-xs font-medium text-temple-brown-light mb-1">
            Marital status
          </label>
          <select
            className="input-field"
            value=""
            onChange={(e) => {
              const next = e.target.value as MarriageFilter;
              if (!next) return;
              onChange({
                ...value,
                marriage: Array.from(new Set([...value.marriage, next])),
              });
            }}
          >
            <option value="">Select</option>
            <option value="SINGLE">Unmarried</option>
            <option value="DIVORCED">Divorced</option>
            <option value="WIDOWED">Widowed</option>
            <option value="WIDOWER">Widower</option>
          </select>

          {value.marriage.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {value.marriage.map((m) => {
                const label =
                  MARRIAGE_OPTIONS.find((o) => o.id === m)?.label || m;
                return chip(label, () =>
                  onChange({
                    ...value,
                    marriage: value.marriage.filter((x) => x !== m),
                  }),
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
