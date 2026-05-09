"use client";

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Eye,
  Pencil,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  LogOut,
  AlertTriangle,
  UserCircle,
  Printer,
  IdCard,
  RotateCcw,
} from "lucide-react";
import {
  teamApi,
  getUser,
  isAuthenticated,
  clearAuth,
  resolvePhotoUrl,
} from "@/lib/api";
import type { Profile, ProfileStatus, Gender, HeightUnit } from "@/types";
import { validateHeightRangeFilter } from "@/lib/height-convert";
import { downloadBiodata, fmtDate, printCard } from "@/lib/download-biodata";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { PanelProfilesFilters } from "@/components/panels/PanelProfilesFilters";
import {
  DEFAULT_PANEL_PROFILE_FILTERS,
  buildPanelProfilesQuery,
  type PanelProfileFilters,
  type SortOption,
} from "@/lib/panel-profile-filters";

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | ProfileStatus;
type GenderFilter = "ALL" | Gender;
type ViewMode = "profiles" | "incomplete";

interface ProfilesResponse {
  data: Profile[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  counts?: {
    total: number;
    today: number;
    online: number;
    offline: number;
  };
}

interface IncompleteUser {
  id: string;
  mobile: string;
  name: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { profiles: number };
}

interface IncompleteUsersResponse {
  data: IncompleteUser[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 15;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING_PAYMENT", label: "Pending Payment" },
  { value: "ACTIVE", label: "Active" },
  { value: "SETTLED", label: "Settled" },
  { value: "INACTIVE", label: "Inactive" },
];

const GENDER_OPTIONS: { value: GenderFilter; label: string }[] = [
  { value: "ALL", label: "All Genders" },
  { value: "BRIDE", label: "Bride" },
  { value: "GROOM", label: "Groom" },
];

const TEAM_STATUS_OPTIONS: ProfileStatus[] = [
  "PENDING_PAYMENT",
  "ACTIVE",
  "SETTLED",
  "INACTIVE",
];

// ─── Badge Helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProfileStatus }) {
  const styles: Record<ProfileStatus, string> = {
    ACTIVE: "bg-green-100 text-green-700 ring-1 ring-green-200",
    PENDING_PAYMENT: "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200",
    SETTLED: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
    INACTIVE: "bg-red-100 text-red-700 ring-1 ring-red-200",
  };

  const labels: Record<ProfileStatus, string> = {
    ACTIVE: "Active",
    PENDING_PAYMENT: "Pending Payment",
    SETTLED: "Settled",
    INACTIVE: "Inactive",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function GenderBadge({ gender }: { gender: Gender }) {
  const styles: Record<Gender, string> = {
    BRIDE: "bg-pink-100 text-pink-700 ring-1 ring-pink-200",
    GROOM: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[gender]}`}
    >
      {gender === "BRIDE" ? "Bride" : "Groom"}
    </span>
  );
}

function TeamStatusDropdown({
  profile,
  loading,
  onStatusChange,
}: {
  profile: Profile;
  loading: boolean;
  onStatusChange: (profile: Profile, nextStatus: ProfileStatus) => Promise<void>;
}) {
  const [current, setCurrent] = useState<ProfileStatus>(profile.status);

  useEffect(() => {
    setCurrent(profile.status);
  }, [profile.status]);

  const colorMap: Record<ProfileStatus, string> = {
    ACTIVE: "text-green-700 bg-green-50 border-green-200",
    PENDING_PAYMENT: "text-yellow-700 bg-yellow-50 border-yellow-200",
    SETTLED: "text-blue-700 bg-blue-50 border-blue-200",
    INACTIVE: "text-red-700 bg-red-50 border-red-200",
  };

  const handleChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = e.target.value as ProfileStatus;
    if (nextStatus === current) return;
    setCurrent(nextStatus);
    try {
      await onStatusChange(profile, nextStatus);
    } catch {
      setCurrent(profile.status);
    }
  };

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={loading}
      className={`text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${colorMap[current]}`}
      aria-label="Change profile status"
    >
      {TEAM_STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s === "PENDING_PAYMENT"
            ? "Pending Payment"
            : s.charAt(0) + s.slice(1).toLowerCase()}
        </option>
      ))}
    </select>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="h-3.5 w-20 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-gray-200" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3.5 w-32 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-14 bg-gray-200 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3.5 w-24 bg-gray-200 rounded font-mono" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-20 bg-gray-200 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3.5 w-20 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-gray-200" />
          <div className="w-7 h-7 rounded-lg bg-gray-200" />
          <div className="w-7 h-7 rounded-lg bg-gray-200" />
        </div>
      </td>
    </tr>
  );
}

// ─── Settle Confirm Dialog ────────────────────────────────────────────────────

function SettleConfirmDialog({
  profile,
  targetSettled,
  onConfirm,
  onCancel,
  loading,
}: {
  profile: Profile;
  targetSettled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  const action = targetSettled ? "Settle" : "Unsettle";
  const description = targetSettled
    ? "This will mark the profile as SETTLED, indicating the match has been found."
    : "This will revert the profile from SETTLED back to ACTIVE.";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-blue-100 p-6">
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${targetSettled ? "bg-blue-50" : "bg-yellow-50"
              }`}
          >
            <AlertTriangle
              size={20}
              className={targetSettled ? "text-blue-600" : "text-yellow-600"}
            />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-base mb-1">
              {action} Profile
            </h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to{" "}
              <span className="font-medium text-gray-800 lowercase">
                {action}
              </span>{" "}
              <span className="font-semibold text-gray-900">
                {profile.fullName}
              </span>{" "}
              ({profile.registrationNumber})?
            </p>
            <p className="text-xs text-gray-500 mt-1.5">{description}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2 ${targetSettled
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-yellow-600 hover:bg-yellow-700"
              }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {targetSettled ? (
                  <CheckCircle size={14} />
                ) : (
                  <XCircle size={14} />
                )}
                Confirm {action}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Detail Modal ─────────────────────────────────────────────────────

function ProfileDetailModal({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    // Prevent body scroll while modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="mb-5">
      <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2 border-b border-[#E8D5C4] pb-1">
        {title}
      </h4>
      <div className="grid md:grid-cols-2 grid-cols-1 gap-x-6 gap-y-1.5">{children}</div>
    </div>
  );
  const Field = ({
    label,
    value,
  }: {
    label: string;
    value: string | number | boolean | null | undefined;
  }) => {
    if (value === null || value === undefined || value === "") return null;
    const display =
      typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
    return (
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide leading-none">
          {label}
        </span>
        <span className="text-sm text-gray-800 font-medium break-words">
          {display}
        </span>
      </div>
    );
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3 pb-1.5 border-b border-blue-100">
      {title}
    </h3>
  );
  function fatherIncomeDisplay(p: Profile): string {
    const v = typeof p.fatherIncome === "string" ? p.fatherIncome.trim() : "";
    if (!v) return "—";
    const typeText = p.fatherIncomeType === "YEARLY" ? "वार्षिक" : "मासिक";
    return `${typeText} : ${p.fatherIncome}`;
  }
  const initials = profile.fullName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  const fullPhotoUrl = resolvePhotoUrl(profile.photoUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-blue-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-gradient-to-r from-[#1D4ED8] to-[#1e40af] rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <ProfileAvatar
              photoUrl={profile.photoUrl}
              name={profile.fullName}
              className="w-10 h-10 rounded-full border-2 border-white/30 flex-shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-white font-bold text-base leading-tight truncate">
                {profile.fullName}
              </h2>
              <p className="text-blue-200 text-xs mt-0.5 font-mono">
                {profile.registrationNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/15 transition-colors flex-shrink-0 ml-3"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status + Gender strip */}
        <div className="flex items-center gap-2.5 px-6 py-3 bg-blue-50/50 border-b border-blue-100 flex-shrink-0">
          <StatusBadge status={profile.status} />
          <GenderBadge gender={profile.gender} />
          {fullPhotoUrl && (
            <a
              href={fullPhotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-blue-600 hover:underline font-medium"
            >
              View full photo
            </a>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">

          <Section title="Personal Details">

            <Field label="Temple/Offline Reg No" value={profile.internalRegistrationNo} />
            <Field label="Date of Birth" value={fmtDate(profile.dateOfBirth)} />
            <Field label="Birth Time" value={profile.birthTime} />
            <Field label="Birth Place" value={profile.birthPlace} />
            <Field label="Height" value={profile.height} />
            <Field label="Weight" value={profile.weight} />
            <Field label="Disability" value={profile.disability ? "Yes" : "No"} />

            {
              profile.disability === true && (
                <Field label="Disability Details" value={profile.disabilityDetails} />
              )
            }

            <Field label="Blood Group" value={profile.bloodGroup} />
            <Field label="Complexion" value={profile.complexion} />
            <Field
              label="Manglik"
              value={profile.manglikStatus?.replace("_", " ")}
            />
            <Field label="Marriage Status" value={profile.marriageStatus} />
            {
              profile.marriageStatus == "DIVORCEE" && (
                <Field label="Divorce Date" value={fmtDate(profile.divorceDate!)} />
              )
            }
            {
              profile.marriageStatus == "WIDOW" || profile.marriageStatus == "WIDOWER" && (
                <Field label="Marriage Date" value={fmtDate(profile.marriageDate!)} />
              )
            }
            {
              profile.marriageStatus !== "UNMARRIED" && (
                <Field label="Children Details" value={profile.childrenDetails} />
              )
            }
            <Field label="Religion" value={profile.religion} />
            <Field label="Caste" value={profile.caste} />
            <Field label="Diet" value={profile.diet} />
            <Field label="Health Status" value={profile.healthStatus} />
            {
              profile.wantToSettleAbroad === true && (
                <Field label="Want to settle abroad" value={profile.wantToSettleAbroad ? "Yes (हाँ)" : "No (नहीं)"} />
              )
            }
            <Field
              label="Glasses"
              value={
                profile.glassesType === "OCCASIONALLY"
                  ? "Occasionally"
                  : profile.glassesType === "YES"
                    ? "Yes"
                    : profile.glassesType === "NO"
                      ? "No"
                      : profile.glasses
                        ? "Yes"
                        : "No"
              }
            />
          </Section>

          <Section title="Education & Profession">
            <Field label="Education" value={profile.education} />
            <Field label="Profession" value={profile.profession} />
            {
              profile.profession === "OTHER" && (
                <Field label="Profession Details" value={profile.professionDetails} />
              )
            }
            <Field
              label="Income"
              value={(() => {
                const cadence = profile.incomeType === "YEARLY" ? "Yearly" : "Monthly";
                const raw = profile.incomeValue?.trim();
                if (raw) {
                  const val = /^\d+$/.test(raw)
                    ? parseInt(raw, 10).toLocaleString("en-IN")
                    : raw;
                  return `${cadence}: ${val}`;
                }
                const rupees = profile.monthlyIncome ?? null;
                if (!rupees) return null;
                return `${cadence}: ${rupees.toLocaleString("en-IN")}`;
              })()}
            />
          </Section>

          <Section title="Family Details">
            <Field label="Father" value={profile.fatherName} />
            <Field label="Father's Profession" value={profile.fatherProfession} />
            <Field label="Father's Income" value={fatherIncomeDisplay(profile)} />
            <Field label="Mother" value={profile.motherName} />
            <Field label="Phone" value={profile.guardianPhone} />
            <Field label="Alternate Mobile" value={profile.alternateMobile} />
            <Field label="Email" value={profile.guardianEmail} />
            <Field label="Address" value={profile.address} />
            <Field label="Married Brothers" value={profile.marriedBrothers} />
            <Field
              label="Unmarried Brothers"
              value={profile.unmarriedBrothers}
            />
            <Field label="Married Sisters" value={profile.marriedSisters} />
            <Field label="Unmarried Sisters" value={profile.unmarriedSisters} />
          </Section>

          <Section title="Property">
            <Field label="House" value={profile.house} />
            <Field label="Other" value={profile.otherProperty} />
          </Section >

          <Section title="Preferences">
            <Field label="Preferred Caste" value={profile.preferredCaste} />

            <Field
              label="Age Range"
              value={
                profile.preferredAgeMin || profile.preferredAgeMax
                  ? `${profile.preferredAgeMin || "—"} to ${profile.preferredAgeMax || "—"}`
                  : null
              }
            />
            <Field label="Location" value={profile.preferredLocation} />
            <Field label="Preference (वरीयता)" value={profile.partnerPreference} />
            <Field label="Preference Details (वरीयता विवरण)" value={profile.partnerPreferenceDetails} />
          </Section>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function TeamProfilesPage() {
  const router = useRouter();

  // ── Auth guard ──
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/auth?type=TEAM");
      return;
    }
    const user = getUser();
    if (user?.role !== "TEAM" && user?.role !== "ADMIN") {
      router.push("/auth?type=TEAM");
    }
  }, [router]);

  // ── Data state ──
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [incompleteUsers, setIncompleteUsers] = useState<IncompleteUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // ── Filter state ──
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [appliedStatusFilter, setAppliedStatusFilter] =
    useState<StatusFilter>("ACTIVE");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("ALL");
  const [appliedGenderFilter, setAppliedGenderFilter] =
    useState<GenderFilter>("ALL");
  /** Team list: backend orders by Profile.updatedAt */
  const [sortUpdatedAt, setSortUpdatedAt] = useState<"asc" | "desc">("desc");
  const [appliedSortUpdatedAt, setAppliedSortUpdatedAt] =
    useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("profiles");
  const [panelFilters, setPanelFilters] = useState<PanelProfileFilters>(
    DEFAULT_PANEL_PROFILE_FILTERS,
  );
  const [appliedPanelFilters, setAppliedPanelFilters] =
    useState<PanelProfileFilters>(DEFAULT_PANEL_PROFILE_FILTERS);
  const [panelSort, setPanelSort] = useState<SortOption>("LATEST");
  const [appliedPanelSort, setAppliedPanelSort] =
    useState<SortOption>("LATEST");
  const [counts, setCounts] = useState<ProfilesResponse["counts"] | null>(null);

  // ── Modal / dialog state ──
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [settleTarget, setSettleTarget] = useState<{
    profile: Profile;
    targetSettled: boolean;
  } | null>(null);
  const [settleLoading, setSettleLoading] = useState(false);

  // ── Optimistic settle tracking (id -> new status while patching) ──
  const [settlingIds, setSettlingIds] = useState<Set<string>>(new Set());

  const applyFilters = () => {
    if (viewMode === "profiles") {
      const unit = (panelFilters.heightUnit || "FT") as HeightUnit;
      const hasH =
        panelFilters.heightMin !== undefined ||
        panelFilters.heightMax !== undefined;
      if (hasH) {
        const msg = validateHeightRangeFilter(
          unit,
          panelFilters.heightMin,
          panelFilters.heightMax,
        );
        if (msg) {
          toast.error(msg);
          return;
        }
      }
    }

    setAppliedSearch(searchInput.trim());
    setAppliedStatusFilter(statusFilter);
    setAppliedGenderFilter(genderFilter);
    setAppliedSortUpdatedAt(sortUpdatedAt);
    setAppliedPanelFilters(panelFilters);
    setAppliedPanelSort(panelSort);
    setCurrentPage(1);
  };

  // ── Fetch profiles ──
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const parts: string[] = [`page=${currentPage}`, `limit=${PAGE_LIMIT}`];
      if (appliedSearch.trim()) {
        parts.push(`search=${encodeURIComponent(appliedSearch.trim())}`);
      }
      if (viewMode === "profiles") {
        if (appliedStatusFilter !== "ALL")
          parts.push(`status=${appliedStatusFilter}`);
        if (appliedGenderFilter !== "ALL")
          parts.push(`gender=${appliedGenderFilter}`);
        parts.push(`sortUpdatedAt=${appliedSortUpdatedAt}`);
        parts.push(...buildPanelProfilesQuery(appliedPanelFilters, appliedPanelSort));
      }

      let totalCount = 0;
      let pages = 1;
      if (viewMode === "profiles") {
        const result = (await teamApi.searchProfiles(
          parts.join("&"),
        )) as ProfilesResponse;
        setProfiles(result.data);
        totalCount = result.total;
        pages = result.totalPages;
        setCounts(result.counts ?? null);
      } else {
        const result = (await teamApi.listIncompleteUsers(
          parts.join("&"),
        )) as IncompleteUsersResponse;
        setIncompleteUsers(result.data);
        totalCount = result.total;
        pages = result.totalPages;
      }
      setTotal(totalCount);
      setTotalPages(pages);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load profiles";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    appliedSearch,
    appliedStatusFilter,
    appliedGenderFilter,
    appliedSortUpdatedAt,
    viewMode,
    appliedPanelFilters,
    appliedPanelSort,
  ]);


  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // ── Toggle settled ──
  const initiateToggleSettled = (profile: Profile) => {
    const currentlySettled = profile.status === "SETTLED";
    setSettleTarget({ profile, targetSettled: !currentlySettled });
  };

  const confirmToggleSettled = async () => {
    if (!settleTarget) return;
    const { profile, targetSettled } = settleTarget;

    setSettleLoading(true);
    setSettlingIds((prev) => new Set(prev).add(profile.id));

    try {
      await teamApi.toggleSettled(profile.id, targetSettled);
      toast.success(
        targetSettled
          ? `${profile.fullName} marked as Settled`
          : `${profile.fullName} reverted to Active`,
      );
      setSettleTarget(null);
      await fetchProfiles();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setSettleLoading(false);
      setSettlingIds((prev) => {
        const next = new Set(prev);
        next.delete(profile.id);
        return next;
      });
    }
  };

  const handleStatusSelect = async (
    profile: Profile,
    nextStatus: ProfileStatus,
  ) => {
    setSettlingIds((prev) => new Set(prev).add(profile.id));
    try {
      await teamApi.updateProfileStatus(profile.id, nextStatus);
      toast.success(`${profile.fullName} status updated to ${nextStatus.replace("_", " ")}`);
      await fetchProfiles();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile";
      toast.error(message);
      throw err;
    } finally {
      setSettlingIds((prev) => {
        const next = new Set(prev);
        next.delete(profile.id);
        return next;
      });
    }
  };

  // ── Pagination info ──
  const startItem = total === 0 ? 0 : (currentPage - 1) * PAGE_LIMIT + 1;
  const endItem = Math.min(currentPage * PAGE_LIMIT, total);

  const clearAllFilters = () => {
    setSearchInput("");
    setStatusFilter("ALL");
    setGenderFilter("ALL");
    setSortUpdatedAt("desc");
    setCurrentPage(1);
    setPanelFilters(DEFAULT_PANEL_PROFILE_FILTERS);
    setPanelSort("LATEST");

    setAppliedSearch("");
    setAppliedStatusFilter("ALL");
    setAppliedGenderFilter("ALL");
    setAppliedSortUpdatedAt("desc");
    setAppliedPanelFilters(DEFAULT_PANEL_PROFILE_FILTERS);
    setAppliedPanelSort("LATEST");
  };

  const hasActiveFilters =
    Boolean(appliedSearch.trim()) ||
    (viewMode === "profiles" &&
      (appliedStatusFilter !== "ALL" ||
        appliedGenderFilter !== "ALL" ||
        appliedSortUpdatedAt !== "desc" ||
        appliedPanelSort !== "LATEST" ||
        appliedPanelFilters.registrationType !== undefined ||
        appliedPanelFilters.manglik !== "ALL" ||
        appliedPanelFilters.disability !== "ALL" ||
        appliedPanelFilters.ageMin !== undefined ||
        appliedPanelFilters.ageMax !== undefined ||
        appliedPanelFilters.heightMin !== undefined ||
        appliedPanelFilters.heightMax !== undefined ||
        appliedPanelFilters.marriage.length > 0 ||
        appliedPanelFilters.datePreset !== DEFAULT_PANEL_PROFILE_FILTERS.datePreset ||
        appliedPanelFilters.dateFrom !== undefined ||
        appliedPanelFilters.dateTo !== undefined));

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Page Header ── */}
      <header className="bg-gradient-to-r from-[#1D4ED8] to-[#1e40af] px-6 py-4 shadow-md rounded-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Users size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-base leading-tight">
                Profile Management
              </h1>
              <p className="text-blue-200 text-xs mt-0.5 font-hindi">
                टीम पैनल — रिश्तेसेतु
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="py-6">
        {/* ── Search & Filter Bar ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("profiles")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === "profiles" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                Profiles
              </button>
              <button
                onClick={() => setViewMode("incomplete")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === "incomplete" ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                Incomplete Profiles
              </button>
            </div>

            {/* Search input */}
            <div className="relative flex-1 ">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
                placeholder="Search by name, mobile, registration no, temple/offline no..."
                className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/10 transition-all"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {viewMode === "profiles" && (
            <div className="mt-3 space-y-3">
              <PanelProfilesFilters
                value={panelFilters}
                sort={panelSort}
                onChange={setPanelFilters}
                onSortChange={setPanelSort}
                isDirty={hasActiveFilters}
                extraFilters={{
                  statusValue: statusFilter,
                  onStatusChange: (v) =>
                    setStatusFilter(v as StatusFilter),
                  statusOptions: STATUS_OPTIONS,
                  genderValue: genderFilter,
                  onGenderChange: (v) =>
                    setGenderFilter(v as GenderFilter),
                  genderOptions: GENDER_OPTIONS,
                }}
              />
            </div>
          )}

          {/* Results summary */}
          <div className="mt-3 flex items-center justify-between">
            {
              viewMode === 'profiles' && (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    aria-label="Apply filters"
                  >
                    <Filter size={14} />
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                    aria-label="Clear all filters"
                  >
                    <RotateCcw size={14} />
                    Clear all
                  </button>
                </div>
              )
            }
            {!loading ? (
              <p className="text-xs text-gray-400">
                {total === 0
                  ? viewMode === "profiles" ? "No profiles found" : "No incomplete users found"
                  : `Showing ${startItem}\u2013${endItem} of ${total} ${viewMode === "profiles" ? `profile${total !== 1 ? "s" : ""}` : `user${total !== 1 ? "s" : ""}`}`}
              </p>
            ) : (
              <p className="text-xs text-gray-400">Loading...</p>
            )}
          </div>

        </div>

        {/* ── Data Table ── */}
        {viewMode === "incomplete" ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Mobile</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Registered On</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Last Login</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : incompleteUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-14 text-center text-sm text-gray-500">
                        No registered users without profile found.
                      </td>
                    </tr>
                  ) : (
                    incompleteUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-gray-700">{u.mobile}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-3 text-gray-600">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-IN") : "Never"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                            Profile Not Created
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1D4ED8]/5 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#1D4ED8] uppercase tracking-wide whitespace-nowrap">
                      Reg #
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#1D4ED8] uppercase tracking-wide whitespace-nowrap">
                      Temple Reg #
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#1D4ED8] uppercase tracking-wide">
                      Photo
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#1D4ED8] uppercase tracking-wide">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#1D4ED8] uppercase tracking-wide">
                      Gender
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#1D4ED8] uppercase tracking-wide">
                      Phone
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#1D4ED8] uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#1D4ED8] uppercase tracking-wide whitespace-nowrap">
                      Date
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#1D4ED8] uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <SkeletonRow key={i} />
                    ))
                  ) : profiles.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Search size={40} className="text-gray-200" />
                          <p className="font-semibold text-gray-500">
                            No profiles found
                          </p>
                          <p className="text-xs text-gray-400">
                            Try adjusting your search or filter criteria
                          </p>
                          {hasActiveFilters && (
                            <button
                              type="button"
                              onClick={clearAllFilters}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 bg-white text-[#1D4ED8] hover:bg-blue-50 mt-1"
                            >
                              <RotateCcw size={14} />
                              Clear all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    profiles.map((profile) => {
                      const isSettled = profile.status === "SETTLED";
                      const isSettling = settlingIds.has(profile.id);

                      return (
                        <tr
                          key={profile.id}
                          className="hover:bg-blue-50/30 transition-colors group"
                        >
                          {/* Reg # */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded">
                              {profile.registrationNumber}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-xs text-gray-600">
                              {profile.internalRegistrationNo || "—"}
                            </span>
                          </td>

                          {/* Photo */}
                          <td className="px-4 py-3">
                            {resolvePhotoUrl(profile.photoUrl) ? (
                              <img
                                src={resolvePhotoUrl(profile.photoUrl)}
                                alt={profile.fullName}
                                className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                                <UserCircle size={18} className="text-blue-300" />
                              </div>
                            )}
                          </td>

                          {/* Name */}
                          <td className="px-4 py-3">
                            <span className="font-semibold text-gray-800 text-sm">
                              {profile.fullName}
                            </span>
                            {profile.fatherName && (
                              <p className="text-xs text-gray-400 leading-tight mt-0.5">
                                S/D of {profile.fatherName}
                              </p>
                            )}
                          </td>

                          {/* Gender */}
                          <td className="px-4 py-3">
                            <GenderBadge gender={profile.gender} />
                          </td>

                          {/* Phone */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-gray-600 font-mono text-xs">
                              {profile.guardianPhone}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <TeamStatusDropdown
                              profile={profile}
                              loading={isSettling}
                              onStatusChange={handleStatusSelect}
                            />
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-xs">
                            {new Date(profile.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => downloadBiodata(profile)}
                                className="rounded-lg  hover:bg-green-50 hover:text-green-600 font-medium inline-flex items-center gap-1 text-xs p-1.5 transition-colors text-gray-400"
                              >
                                <Printer size={16} />
                              </button>
                              <button
                                onClick={() => printCard(profile)}
                                className="rounded-lg  hover:bg-red-50 hover:text-red-600 font-medium inline-flex items-center gap-1 text-xs p-1.5 transition-colors text-gray-400"
                              >
                                <IdCard size={16} />
                              </button>
                              {/* View */}
                              <button
                                onClick={() => setViewProfile(profile)}
                                title="View full profile"
                                aria-label={`View profile of ${profile.fullName}`}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-[#1D4ED8] hover:bg-blue-50 transition-colors"
                              >
                                <Eye size={16} />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() =>
                                  router.push(`/team/register?edit=${profile.id}`)
                                }
                                title="Edit profile"
                                aria-label={`Edit profile of ${profile.fullName}`}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              >
                                <Pencil size={16} />
                              </button>

                              {/* Settle / Unsettle toggle */}
                              <button
                                onClick={() => initiateToggleSettled(profile)}
                                disabled={isSettling}
                                title={
                                  isSettled
                                    ? "Mark as Unsettled"
                                    : "Mark as Settled"
                                }
                                aria-label={
                                  isSettled
                                    ? `Unsettle ${profile.fullName}`
                                    : `Settle ${profile.fullName}`
                                }
                                className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isSettled
                                  ? "text-blue-600 hover:text-red-500 hover:bg-red-50"
                                  : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                  }`}
                              >
                                {isSettling ? (
                                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                                ) : isSettled ? (
                                  <XCircle size={16} />
                                ) : (
                                  <CheckCircle size={16} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white hover:border-[#1D4ED8]/40 hover:text-[#1D4ED8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-gray-200 disabled:hover:text-gray-600"
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>

                <span className="text-sm text-gray-500 font-medium">
                  Page{" "}
                  <span className="text-[#1D4ED8] font-semibold">
                    {currentPage}
                  </span>{" "}
                  of{" "}
                  <span className="text-[#1D4ED8] font-semibold">
                    {totalPages}
                  </span>
                </span>

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white hover:border-[#1D4ED8]/40 hover:text-[#1D4ED8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-gray-200 disabled:hover:text-gray-600"
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>
            )}

            {/* Single-page footer count */}
            {!loading && totalPages <= 1 && total > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-400 text-center">
                {total} profile{total !== 1 ? "s" : ""} total
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Profile Detail Modal ── */}
      {viewProfile && (
        <ProfileDetailModal
          profile={viewProfile}
          onClose={() => setViewProfile(null)}
        />
      )}

      {/* ── Settle / Unsettle Confirm Dialog ── */}
      {settleTarget && (
        <SettleConfirmDialog
          profile={settleTarget.profile}
          targetSettled={settleTarget.targetSettled}
          onConfirm={confirmToggleSettled}
          onCancel={() => setSettleTarget(null)}
          loading={settleLoading}
        />
      )}
    </div>
  );
}