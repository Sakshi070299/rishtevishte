"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Search,
  Filter,
  AlertCircle,
  Clock,
  Eye,
  X,
} from "lucide-react";
import { searchApi, resolvePhotoUrl } from "@/lib/api";
import type { SearchResult, WeeklyLimitInfo, SearchFilters, HeightUnit } from "@/types";
import {
  heightToCm,
  validateHeightRangeFilter,
} from "@/lib/height-convert";
import { downloadBiodata, printCard } from "@/lib/download-biodata";
import { State } from "country-state-city";

const PROFESSION_LABELS: Record<string, string> = {
  PRIVATE_JOB: "Private Job",
  GOVERNMENT_JOB: "Government Job",
  JOB: "Job",
  BUSINESS: "Business",
  HOMELY: "Homely",
  OTHER: "Other",
};

const MARRIAGE_STATUS_LABELS: Record<string, string> = {
  UNMARRIED: "Unmarried (अविवाहित)",
  DIVORCEE: "Divorcee (तलाकशुदा)",
  WIDOW: "Widow (विधवा)",
  WIDOWER: "Widower (विधुर)",
};

const INDIA_STATE_OPTIONS = State.getStatesOfCountry("IN")
  .map((s) => s.name)
  .sort((a, b) => a.localeCompare(b));

// ─── Helpers (same as Profiles page) ──────────────────────────



export default function SearchPage() {
  const [filters, setFilters] = useState<SearchFilters>({});
  const [casteInput, setCasteInput] = useState("");
  const [stateToAdd, setStateToAdd] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [weekInfo, setWeekInfo] = useState<WeeklyLimitInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    searchApi
      .remaining()
      .then((data) => setWeekInfo(data as WeeklyLimitInfo))
      .catch(() => { });
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    try {
      if (filters.incomeMin !== undefined && filters.incomeMin < 10000) {
        toast.error('Min Income must be at least ₹10,000');
        return;
      }

      const unit = (filters.heightUnit || "FT") as HeightUnit;
      const hasH =
        filters.heightMin !== undefined || filters.heightMax !== undefined;
      if (hasH) {
        const msg = validateHeightRangeFilter(
          unit,
          filters.heightMin,
          filters.heightMax,
        );
        if (msg) {
          toast.error(msg);
          return;
        }
      }

      const searchFilters = {
        ...filters,
        height: undefined,
        caste: casteInput
          ? casteInput
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
          : undefined,
      };
      const data = (await searchApi.search(searchFilters)) as SearchResult;
      setResults(data);
      setWeekInfo((prev) =>
        prev
          ? {
            ...prev,
            remaining: data.remaining,
            viewed: prev.limit - data.remaining,
          }
          : prev,
      );
      if (data.profiles.length === 0) toast.info("No matching profiles found");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const upd = (key: keyof SearchFilters, val: any) =>
    setFilters((p) => ({ ...p, [key]: val || undefined }));

  return (
    <div className="max-w-5xl mx-auto">
      {/* Weekly Limit Banner */}
      {weekInfo && (
        <div
          className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${weekInfo.remaining > 0
            ? "bg-green-50 border border-green-200"
            : "bg-red-50 border border-red-200"
            }`}
        >
          <Clock
            size={20}
            className={
              weekInfo.remaining > 0 ? "text-green-600" : "text-red-600"
            }
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-temple-brown">
              {weekInfo.remaining > 0
                ? `${weekInfo.remaining} of ${weekInfo.limit} profile views remaining this week`
                : "Weekly limit reached! New profiles unlock on Sunday"}
            </p>
            <p className="text-xs text-temple-brown-light">
              Week: {new Date(weekInfo.weekStart).toLocaleDateString()} —{" "}
              {new Date(weekInfo.weekEnd).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <span
              className={`text-2xl font-bold ${weekInfo.remaining > 0 ? "text-green-600" : "text-red-600"}`}
            >
              {weekInfo.remaining}/{weekInfo.limit}
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-[#E8D5C4] mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-primary" />
            <h2 className="font-bold text-temple-brown">Search Filters</h2>
            <span className="font-hindi text-primary text-sm">खोज फिल्टर</span>
          </div>
          <span className="text-xs text-temple-brown-light">
            {showFilters ? "Hide" : "Show"}
          </span>
        </button>

        {showFilters && (
          <div className="p-3.5 sm:p-5 pt-0 border-t border-[#E8D5C4]">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {/* Gender */}
              <div>
                <label className="block text-xs font-medium text-temple-brown-light mb-1">
                  Gender <span className="font-hindi text-primary">लिंग</span>
                </label>
                <select
                  className="input-field"
                  value={filters.gender || ""}
                  onChange={(e) => upd("gender", e.target.value)}
                >
                  <option value="">All</option>
                  <option value="BRIDE">Bride (वधू)</option>
                  <option value="GROOM">Groom (वर)</option>
                </select>
              </div>

              {/* Manglik */}
              <div>
                <label className="block text-xs font-medium text-temple-brown-light mb-1">
                  Manglik{" "}
                  <span className="font-hindi text-primary">मांगलिक</span>
                </label>
                <select
                  className="input-field"
                  value={filters.manglikStatus || ""}
                  onChange={(e) => upd("manglikStatus", e.target.value)}
                >
                  <option value="">All</option>
                  <option value="MANGLIK">Manglik</option>
                  <option value="NON_MANGLIK">Non Manglik</option>
                  <option value="ANSHIK_MANGLIK">Anshik Manglik</option>
                </select>
              </div>

              {/* Marital Status */}
              <div>
                <label className="block text-xs font-medium text-temple-brown-light mb-1">
                  Marital Status{" "}
                  <span className="font-hindi text-primary">वैवाहिक स्थिति</span>
                </label>
                <select
                  className="input-field"
                  value={filters.marriageStatus || ""}
                  onChange={(e) => upd("marriageStatus", e.target.value)}
                >
                  <option value="">All</option>
                  {Object.entries(MARRIAGE_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Profession */}
              <div>
                <label className="block text-xs font-medium text-temple-brown-light mb-1">
                  Profession{" "}
                  <span className="font-hindi text-primary">व्यवसाय</span>
                </label>
                <select
                  className="input-field"
                  value={filters.profession || ""}
                  onChange={(e) => upd("profession", e.target.value)}
                >
                  <option value="">All</option>
                  <option value="PRIVATE_JOB">Private Job</option>
                  <option value="GOVERNMENT_JOB">Government Job</option>
                  <option value="JOB">Job (Legacy)</option>
                  <option value="BUSINESS">Business</option>
                  <option value="HOMELY">Homely</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Age Range */}
              <div>
                <label className="block text-xs font-medium text-temple-brown-light mb-1">
                  Preferred Age Range{" "}
                  <span className="font-hindi text-primary">पसंदीदा आयु सीमा</span>
                </label>
                <div className="flex items-center gap-2 border border-[#E8D5C4] rounded-lg">
                  <input
                    type="number"
                    className="input-field border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent"
                    placeholder="Age From"
                    value={filters.ageMin || ""}
                    onChange={(e) =>
                      upd("ageMin", parseInt(e.target.value) || undefined)
                    }
                  />
                  <span className="text-temple-brown-light select-none">-</span>
                  <input
                    type="number"
                    className="input-field border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent"
                    placeholder="Age To"
                    value={filters.ageMax || ""}
                    onChange={(e) =>
                      upd("ageMax", parseInt(e.target.value) || undefined)
                    }
                  />
                </div>
              </div>

              {/* Height min–max (same unit); server converts profiles from ft/in/cm to cm */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-temple-brown-light mb-1">
                  Height range (min – max){" "}
                  <span className="font-hindi text-primary">ऊँचाई</span>
                </label>
                <div className="flex flex-wrap items-center gap-2 border border-[#E8D5C4] rounded-lg p-0.5">
                  <input
                    type="number"
                    step="0.1"
                    className="input-field min-w-[5rem] flex-1 border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent"
                    placeholder={
                      filters.heightUnit === "CM"
                        ? "Min cm"
                        : filters.heightUnit === "IN"
                          ? "Min in"
                          : "Min e.g. 5.1"
                    }
                    value={filters.heightMin ?? ""}
                    onChange={(e) =>
                      setFilters((p) => ({
                        ...p,
                        heightMin: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                    aria-label="Minimum height"
                  />
                  <span className="text-temple-brown-light select-none">–</span>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field min-w-[5rem] flex-1 border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent"
                    placeholder={
                      filters.heightUnit === "CM"
                        ? "Max cm"
                        : filters.heightUnit === "IN"
                          ? "Max in"
                          : "Max e.g. 5.5"
                    }
                    value={filters.heightMax ?? ""}
                    onChange={(e) =>
                      setFilters((p) => ({
                        ...p,
                        heightMax: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                    aria-label="Maximum height"
                  />
                  <select
                    className="h-[33px] shrink-0 rounded-lg border border-[#E8D5C4] bg-white px-2 text-xs font-semibold text-temple-brown focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={filters.heightUnit || "FT"}
                    onChange={(e) =>
                      setFilters((p) => ({
                        ...p,
                        heightUnit: e.target.value as HeightUnit,
                        heightMin: undefined,
                        heightMax: undefined,
                        height: undefined,
                      }))
                    }
                    aria-label="Height unit"
                  >
                    <option value="FT">FT</option>
                    <option value="IN">IN</option>
                    <option value="CM">CM</option>
                  </select>
                </div>
                <p className="mt-1 text-[10px] leading-snug text-temple-brown/55">
                  {/* Profiles saved in ft, in, or cm are matched using the same cm conversion as
                  registration. Leave min and max empty to ignore height; you may set only
                  one side for an open-ended range. */}
                  {filters.heightMin != null &&
                    filters.heightMax != null &&
                    Number.isFinite(filters.heightMin) &&
                    Number.isFinite(filters.heightMax) &&
                    !validateHeightRangeFilter(
                      (filters.heightUnit || "FT") as HeightUnit,
                      filters.heightMin,
                      filters.heightMax,
                    )}
                </p>
              </div>

              {/* Income Range */}
              <div>
                <label className="block text-xs font-medium text-temple-brown-light mb-1">
                  Min Income (₹){" "}
                  <span className="font-hindi text-primary">न्यूनतम आय</span>
                </label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="e.g. 20000"
                  value={filters.incomeMin || ""}
                  onChange={(e) =>
                    upd("incomeMin", parseInt(e.target.value) || undefined)
                  }
                />
              </div>

              {/* Max Income */}
              <div>
                <label className="block text-xs font-medium text-temple-brown-light mb-1">
                  Max Income (₹){" "}
                  <span className="font-hindi text-primary">अधिकतम आय</span>
                </label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="e.g. 100000"
                  value={filters.incomeMax || ""}
                  onChange={(e) =>
                    upd("incomeMax", parseInt(e.target.value) || undefined)
                  }
                />
              </div>

              {/* Disability */}
              <div>
                <label className="block text-xs font-medium text-temple-brown-light mb-1">
                  Disability{" "}
                  <span className="font-hindi text-primary">विकलांगता</span>
                </label>
                <select
                  className="input-field"
                  value={
                    filters.disability === undefined
                      ? ""
                      : String(filters.disability)
                  }
                  onChange={(e) =>
                    upd(
                      "disability",
                      e.target.value === ""
                        ? undefined
                        : e.target.value === "true",
                    )
                  }
                >
                  <option value="">All</option>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>

              {/* Caste / Community */}
              <div>
                <label className="block text-xs font-medium text-temple-brown-light mb-1">
                  Caste / Community{" "}
                  <span className="font-hindi text-primary">जाति</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Punjabi, Saini, Hindu"
                  value={casteInput}
                  onChange={(e) => setCasteInput(e.target.value)}
                />
                <p className="text-[10px] text-temple-brown-light mt-1">
                  Comma-separated
                </p>
              </div>

              {/* States (multi) */}
              <div>
                <label className="block text-xs font-medium text-temple-brown-light mb-1">
                  Preferred Location <span className="font-hindi text-primary">पसंदीदा स्थान</span>
                </label>

                <select
                  className="input-field"
                  value={stateToAdd}
                  onChange={(e) => {
                    const next = e.target.value;
                    setStateToAdd(next);
                    if (!next) return;

                    setFilters((p) => {
                      const prev = p.states ?? [];
                      const merged = Array.from(new Set([...prev, next]));
                      return { ...p, states: merged.length ? merged : undefined };
                    });

                    setStateToAdd("");
                  }}
                >
                  <option value="">Add a state…</option>
                  {INDIA_STATE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {filters.states && filters.states.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {filters.states.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 rounded-full border border-[#E8D5C4] bg-[#FFF7F0] px-2 py-1 text-xs font-medium text-temple-brown"
                      >
                        {s}
                        <button
                          type="button"
                          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/5"
                          onClick={() =>
                            setFilters((p) => {
                              const nextStates = (p.states ?? []).filter((x) => x !== s);
                              return {
                                ...p,
                                states: nextStates.length ? nextStates : undefined,
                              };
                            })
                          }
                          aria-label={`Remove state ${s}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 sm:flex gap-3">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="btn-primary px-3 sm:px-6  text-sm text-center justify-center"
              >
                {loading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Search size={16} />
                )}
                {loading ? "Searching..." : "Search Profiles"}
              </button>
              <button
                onClick={() => {
                  setFilters({});
                  setCasteInput("");
                  setStateToAdd("");
                  setResults(null);
                }}
                className="btn-outline px-3 sm:px-6  text-sm text-center justify-center"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-temple-brown">
              {results.count} Profile{results.count !== 1 ? "s" : ""} Found
              <span className="font-hindi text-primary text-sm ml-2">
                प्रोफाइल मिले
              </span>
            </h3>
            <span className="text-xs text-temple-brown-light">
              {results.remaining} views remaining
            </span>
          </div>

          <div className="grid gap-4">
            {results.profiles.map((profile) => (
              <div
                key={profile.id}
                className="bg-white rounded-xl shadow-md border border-[#E8D5C4] p-5"
              >
                <div className="flex gap-4">
                  {resolvePhotoUrl(profile.photoUrl) && (
                    <img
                      src={resolvePhotoUrl(profile.photoUrl)}
                      alt={profile.fullName}
                      className="w-20 h-24 rounded-lg object-cover border-2 border-gold flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <span className="text-temple-brown-light">Name:</span>{" "}
                      <strong>{profile.fullName}</strong>
                    </div>
                    <div>
                      <span className="text-temple-brown-light">Father:</span>{" "}
                      {profile.fatherName}
                    </div>
                    <div>
                      <span className="text-temple-brown-light">Mobile:</span>{" "}
                      {profile.guardianPhone}
                    </div>
                    <div>
                      <span className="text-temple-brown-light">DOB:</span>{" "}
                      {new Date(profile.dateOfBirth).toLocaleDateString(
                        "en-IN",
                      )}
                    </div>
                    <div>
                      <span className="text-temple-brown-light">
                        Birth Time:
                      </span>{" "}
                      {profile.birthTime || "—"}
                    </div>
                    <div>
                      <span className="text-temple-brown-light">
                        Birth Place:
                      </span>{" "}
                      {profile.birthPlace || "—"}
                    </div>
                    <div>
                      <span className="text-temple-brown-light">Manglik:</span>{" "}
                      <span
                        className={`font-semibold ${profile.manglikStatus === "MANGLIK" ? "text-red-600" : "text-green-600"}`}
                      >
                        {profile.manglikStatus.replace("_", " ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-temple-brown-light">City:</span>{" "}
                      {profile.city || "—"}
                    </div>
                    <div>
                      <span className="text-temple-brown-light">State:</span>{" "}
                      {profile.state || "—"}
                    </div>
                    <div>
                      <span className="text-temple-brown-light">
                        Profession:
                      </span>{" "}
                      {PROFESSION_LABELS[profile.profession] || profile.profession}
                    </div>
                    <div>
                      <span className="text-temple-brown-light">Income:</span>{" "}
                      {(() => {
                        const raw = profile.incomeValue?.trim();
                        const cadence = profile.incomeType === "YEARLY" ? "Yearly" : "Monthly";
                        if (raw) {
                          const val = /^\d+$/.test(raw)
                            ? parseInt(raw, 10).toLocaleString("en-IN")
                            : raw;
                          return `${cadence}: ${val}`;
                        }
                        const rupees = profile.monthlyIncome ?? null;
                        if (!rupees) return "—";
                        return `${cadence}: ${rupees.toLocaleString("en-IN")}`;
                      })()}
                    </div>
                    <div>
                      <span className="text-temple-brown-light">
                        Disability:
                      </span>{" "}
                      {profile.disability ? "Yes" : "No"}
                    </div>
                    <div>
                      <span className="text-temple-brown-light">
                        Marital Status:
                      </span>{" "}
                      {MARRIAGE_STATUS_LABELS[profile.marriageStatus] || profile.marriageStatus}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t border-[#E8D5C4]">
                  <button
                    type="button"
                    onClick={() => downloadBiodata(profile)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 flex items-center gap-1"
                  >
                    <Eye size={12} /> View Biodata
                  </button>
                  <button
                    type="button"
                    onClick={() => printCard(profile)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-maroon/10 text-maroon font-medium hover:bg-maroon/20 flex items-center gap-1"
                  >
                    <Eye size={12} /> View Card
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {results && results.count === 0 && (
        <div className="text-center py-16">
          <AlertCircle
            size={48}
            className="text-temple-brown-light mx-auto mb-4 opacity-40"
          />
          <h3 className="font-bold text-temple-brown mb-1">
            No Profiles Found
          </h3>
          <p className="text-sm text-temple-brown-light">
            Try adjusting your filters or check back next week for new profiles.
          </p>
        </div>
      )}
    </div>
  );
}
