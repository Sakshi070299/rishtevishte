'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search,
  Filter,
  Eye,
  Trash2,
  AlertTriangle,
  Printer,
  IdCard,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Edit2,
  RotateCcw,
} from 'lucide-react';
import { adminApi, resolvePhotoUrl } from '@/lib/api';
import type { Profile, ProfileStatus, Gender } from '@/types';
import { downloadBiodata, printCard } from '@/lib/download-biodata';
import { ViewModal } from '@/components/ViewModal';
import { PanelProfilesFilters } from "@/components/panels/PanelProfilesFilters";
import {
  DEFAULT_PANEL_PROFILE_FILTERS,
  buildPanelProfilesQuery,
  type PanelProfileFilters,
  type SortOption,
} from "@/lib/panel-profile-filters";
import type { HeightUnit } from "@/types";
import { validateHeightRangeFilter } from "@/lib/height-convert";


// ─── Types ──────────────────────────────────────────────────────────────────

type StatusFilter = 'ALL' | ProfileStatus;
type GenderFilter = 'ALL' | Gender;
type ViewMode = 'profiles' | 'incomplete';

interface StaffMember { id: string; name: string | null; role: string; }

interface ProfilesResponse {
  data: Profile[];
  total: number;
  page: number;
  totalPages: number;
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
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_LIMIT = 20;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING_PAYMENT', label: 'Pending Payment' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SETTLED', label: 'Settled' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const GENDER_OPTIONS: { value: GenderFilter; label: string }[] = [
  { value: 'ALL', label: 'All Genders' },
  { value: 'BRIDE', label: 'Bride' },
  { value: 'GROOM', label: 'Groom' },
];

const PROFILE_STATUSES: ProfileStatus[] = [
  'PENDING_PAYMENT',
  'ACTIVE',
  'SETTLED',
  'INACTIVE',
];

// ─── Badge Helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProfileStatus }) {
  const styles: Record<ProfileStatus, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700',
    SETTLED: 'bg-blue-100 text-blue-700',
    INACTIVE: 'bg-red-100 text-red-700',
  };

  const labels: Record<ProfileStatus, string> = {
    ACTIVE: 'Active',
    PENDING_PAYMENT: 'Pending Payment',
    SETTLED: 'Settled',
    INACTIVE: 'Inactive',
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
    BRIDE: 'bg-pink-100 text-pink-700',
    GROOM: 'bg-blue-100 text-blue-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[gender]}`}
    >
      {gender === 'BRIDE' ? 'Bride' : 'Groom'}
    </span>
  );
}

// ─── Profile Detail Modal ─────────────────────────────────────────────────────

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
  profile,
  onConfirm,
  onCancel,
  loading,
}: {
  profile: Profile;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#E8D5C4] p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-temple-brown text-base mb-1">
              Delete Profile
            </h3>
            <p className="text-sm text-temple-brown/70">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-temple-brown">
                {profile.fullName}
              </span>{' '}
              ({profile.registrationNumber})? This action permanently deletes the
              profile and related records and cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold text-temple-brown border border-[#E8D5C4] rounded-lg hover:bg-[#FFF8F0] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={14} />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Change Dropdown ──────────────────────────────────────────────────

function StatusDropdown({
  profile,
  onStatusChange,
}: {
  profile: Profile;
  onStatusChange: (id: string, status: ProfileStatus) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<ProfileStatus>(profile.status);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as ProfileStatus;
    if (newStatus === current) return;
    setLoading(true);
    try {
      await onStatusChange(profile.id, newStatus);
      setCurrent(newStatus);
    } catch {
      // error already toasted by parent
    } finally {
      setLoading(false);
    }
  };

  const colorMap: Record<ProfileStatus, string> = {
    ACTIVE: 'text-green-700 bg-green-50 border-green-200',
    PENDING_PAYMENT: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    SETTLED: 'text-blue-700 bg-blue-50 border-blue-200',
    INACTIVE: 'text-red-700 bg-red-50 border-red-200',
  };

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={loading}
      className={`text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#8B1A1A]/20 transition-colors disabled:opacity-60 ${colorMap[current]}`}
      aria-label="Change profile status"
    >
      {PROFILE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s === 'PENDING_PAYMENT' ? 'Pending Payment' : s.charAt(0) + s.slice(1).toLowerCase()}
        </option>
      ))}
    </select>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-[#E8D5C4]/60 rounded" />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function AdminProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [incompleteUsers, setIncompleteUsers] = useState<IncompleteUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [appliedStatusFilter, setAppliedStatusFilter] =
    useState<StatusFilter>('ACTIVE');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('ALL');
  const [appliedGenderFilter, setAppliedGenderFilter] =
    useState<GenderFilter>('ALL');
  const [creatorFilter, setCreatorFilter] = useState<string>('ALL');
  const [appliedCreatorFilter, setAppliedCreatorFilter] =
    useState<string>('ALL');
  const [panelFilters, setPanelFilters] = useState<PanelProfileFilters>(
    DEFAULT_PANEL_PROFILE_FILTERS,
  );
  const [panelSort, setPanelSort] = useState<SortOption>("LATEST");
  const [appliedPanelFilters, setAppliedPanelFilters] =
    useState<PanelProfileFilters>(DEFAULT_PANEL_PROFILE_FILTERS);
  const [appliedPanelSort, setAppliedPanelSort] =
    useState<SortOption>("LATEST");
  const [counts, setCounts] = useState<ProfilesResponse["counts"] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('profiles');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [settlingIds, setSettlingIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const applyFilters = () => {
    if (viewMode === 'profiles') {
      const unit = (panelFilters.heightUnit || 'FT') as HeightUnit;
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

    setAppliedSearch(search.trim());
    setAppliedStatusFilter(statusFilter);
    setAppliedGenderFilter(genderFilter);
    setAppliedCreatorFilter(creatorFilter);
    setAppliedPanelFilters(panelFilters);
    setAppliedPanelSort(panelSort);
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(appliedSearch.trim()) ||
    (viewMode === 'profiles' &&
      (appliedStatusFilter !== 'ALL' ||
        appliedGenderFilter !== 'ALL' ||
        appliedCreatorFilter !== 'ALL' ||
        appliedPanelSort !== 'LATEST' ||
        appliedPanelFilters.registrationType !== undefined ||
        appliedPanelFilters.manglik !== 'ALL' ||
        appliedPanelFilters.disability !== 'ALL' ||
        appliedPanelFilters.ageMin !== undefined ||
        appliedPanelFilters.ageMax !== undefined ||
        appliedPanelFilters.heightMin !== undefined ||
        appliedPanelFilters.heightMax !== undefined ||
        appliedPanelFilters.marriage.length > 0 ||
        appliedPanelFilters.datePreset !== DEFAULT_PANEL_PROFILE_FILTERS.datePreset ||
        appliedPanelFilters.dateFrom !== undefined ||
        appliedPanelFilters.dateTo !== undefined));

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setGenderFilter('ALL');
    setCreatorFilter('ALL');
    setPanelFilters(DEFAULT_PANEL_PROFILE_FILTERS);
    setPanelSort("LATEST");
    setCurrentPage(1);

    setAppliedSearch('');
    setAppliedStatusFilter('ALL');
    setAppliedGenderFilter('ALL');
    setAppliedCreatorFilter('ALL');
    setAppliedPanelFilters(DEFAULT_PANEL_PROFILE_FILTERS);
    setAppliedPanelSort("LATEST");
  };

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const parts: string[] = [`page=${currentPage}`, `limit=${PAGE_LIMIT}`];
      if (appliedSearch.trim()) parts.push(`search=${encodeURIComponent(appliedSearch.trim())}`);
      if (viewMode === 'profiles') {
        if (appliedStatusFilter !== 'ALL') parts.push(`status=${appliedStatusFilter}`);
        if (appliedGenderFilter !== 'ALL') parts.push(`gender=${appliedGenderFilter}`);
        if (appliedCreatorFilter !== 'ALL') parts.push(`createdById=${appliedCreatorFilter}`);
        parts.push(...buildPanelProfilesQuery(appliedPanelFilters, appliedPanelSort));
      }

      let totalCount = 0;
      let pages = 1;
      if (viewMode === 'profiles') {
        const result = await adminApi.listProfiles(parts.join('&')) as ProfilesResponse;
        setProfiles(result.data);
        totalCount = result.total;
        pages = result.totalPages;
        setCounts(result.counts ?? null);
      } else {
        const result = await adminApi.listIncompleteUsers(parts.join('&')) as IncompleteUsersResponse;
        setIncompleteUsers(result.data);
        totalCount = result.total;
        pages = result.totalPages;
      }
      setTotal(totalCount);
      setTotalPages(pages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load profiles';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    appliedSearch,
    appliedStatusFilter,
    appliedGenderFilter,
    appliedCreatorFilter,
    viewMode,
    appliedPanelFilters,
    appliedPanelSort,
  ]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Load staff list for creator filter dropdown
  useEffect(() => {
    Promise.all([
      adminApi.listTeam() as Promise<StaffMember[]>,
      adminApi.listManagers() as Promise<StaffMember[]>,
    ]).then(([team, managers]) => {
      setStaffList([...team, ...managers]);
    }).catch(() => { });
  }, []);

  const handleStatusChange = async (id: string, status: ProfileStatus) => {
    try {
      await adminApi.updateProfileStatus(id, status);
      toast.success('Profile status updated');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(message);
      throw err;
    }
  };

  const handleQuickToggleSettled = async (profile: Profile) => {
    const targetStatus: ProfileStatus =
      profile.status === 'SETTLED' ? 'ACTIVE' : 'SETTLED';
    setSettlingIds((prev) => new Set(prev).add(profile.id));
    try {
      await adminApi.updateProfileStatus(profile.id, targetStatus);
      toast.success(
        targetStatus === 'SETTLED'
          ? `${profile.fullName} marked as Settled`
          : `${profile.fullName} reverted to Active`,
      );
      await fetchProfiles();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      toast.error(message);
    } finally {
      setSettlingIds((prev) => {
        const next = new Set(prev);
        next.delete(profile.id);
        return next;
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await adminApi.deleteProfile(deleteTarget.id);
      toast.success(`Profile "${deleteTarget.fullName}" deleted`);
      setDeleteTarget(null);
      // Refresh current page; if it becomes empty go back one page
      setCurrentPage((prev) => {
        const remaining = profiles.length - 1;
        if (remaining === 0 && prev > 1) return prev - 1;
        return prev;
      });
      await fetchProfiles();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete profile';
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const startItem = total === 0 ? 0 : (currentPage - 1) * PAGE_LIMIT + 1;
  const endItem = Math.min(currentPage * PAGE_LIMIT, total);

  return (
    <div className="min-h-screen bg-[#FFF8F0]">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-[#8B1A1A] to-[#5a0f0f] px-6 py-5 rounded-xl">
        <div>
          <h1 className="text-white font-bold text-xl">Profile Management</h1>
          <p className="text-white/60 text-xs mt-0.5 font-hindi">
            सभी प्रोफाइल — रिश्तेसेतु
          </p>
        </div>
      </div>

      <div className="py-6">
        {/* ── Search & Filter Bar ── */}
        <div className="bg-white rounded-xl border border-[#2b221a] shadow-sm p-4 mb-5">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('profiles')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === 'profiles' ? 'bg-[#8B1A1A] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Profiles
              </button>
              <button
                onClick={() => setViewMode('incomplete')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === 'incomplete' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Incomplete Profiles
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 ">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-temple-brown/40 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyFilters();
                }}
                placeholder="Search by name, reg no, temple/offline no, or phone..."
                className="w-full pl-9 pr-8 py-2.5 text-sm border border-[#E8D5C4] rounded-lg bg-[#FFF8F0] text-temple-brown placeholder:text-temple-brown/40 focus:outline-none focus:border-[#8B1A1A] focus:ring-2 focus:ring-[#8B1A1A]/10 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-temple-brown/40 hover:text-temple-brown transition-colors"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 flex-wrap">

            {/* Filters */}
            {viewMode === 'profiles' && (
              <div />
            )}
          </div>

          {viewMode === 'profiles' && (
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
                  creator: {
                    value: creatorFilter,
                    onChange: setCreatorFilter,
                    staff: staffList,
                  },
                }}
              />

              {/* {counts && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg border border-[#E8D5C4] bg-[#FFF8F0] px-3 py-2">
                    <div className="text-[11px] text-temple-brown/60">Total</div>
                    <div className="text-sm font-bold text-temple-brown">{counts.total}</div>
                  </div>
                  <div className="rounded-lg border border-[#E8D5C4] bg-[#FFF8F0] px-3 py-2">
                    <div className="text-[11px] text-temple-brown/60">Today</div>
                    <div className="text-sm font-bold text-temple-brown">{counts.today}</div>
                  </div>
                  <div className="rounded-lg border border-[#E8D5C4] bg-[#FFF8F0] px-3 py-2">
                    <div className="text-[11px] text-temple-brown/60">Online</div>
                    <div className="text-sm font-bold text-temple-brown">{counts.online}</div>
                  </div>
                  <div className="rounded-lg border border-[#E8D5C4] bg-[#FFF8F0] px-3 py-2">
                    <div className="text-[11px] text-temple-brown/60">Offline</div>
                    <div className="text-sm font-bold text-temple-brown">{counts.offline}</div>
                  </div>
                </div>
              )} */}
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
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#8B1A1A] text-white hover:bg-[#7A1616] transition-colors"
                    aria-label="Apply filters"
                  >
                    <Filter size={14} />
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-[#E8D5C4] bg-white text-temple-brown hover:bg-[#FFF8F0] transition-colors"
                    aria-label="Clear all filters"
                  >
                    <RotateCcw size={14} />
                    Clear all
                  </button>
                </div>
              )
            }
            {!loading && (
              <p className="text-xs text-temple-brown/50 ">
                {total === 0
                  ? viewMode === 'profiles' ? 'No profiles found' : 'No incomplete users found'
                  : `Showing ${startItem}–${endItem} of ${total} ${viewMode === 'profiles' ? `profile${total !== 1 ? 's' : ''}` : `user${total !== 1 ? 's' : ''}`}`}
              </p>
            )}
          </div>
        </div>

        {/* ── Data Table ── */}
        {viewMode === 'incomplete' ? (
          <div className="bg-white rounded-xl border border-[#E8D5C4] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-50 border-b border-[#E8D5C4]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Mobile</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Registered On</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Last Login</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8D5C4]/60">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><div className="h-4 bg-[#E8D5C4]/60 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-[#E8D5C4]/60 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-[#E8D5C4]/60 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-[#E8D5C4]/60 rounded" /></td>
                      </tr>
                    ))
                  ) : incompleteUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-14 text-center text-sm text-temple-brown/60">
                        No registered users without profile found.
                      </td>
                    </tr>
                  ) : (
                    incompleteUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-temple-brown/80">{u.mobile}</td>
                        <td className="px-4 py-3 text-temple-brown/70">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3 text-temple-brown/70">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'Never'}</td>
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
          <div className="bg-white rounded-xl border border-[#E8D5C4] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#8B1A1A]/5 border-b border-[#E8D5C4]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B1A1A] uppercase tracking-wide whitespace-nowrap">
                      Reg #
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B1A1A] uppercase tracking-wide whitespace-nowrap">
                      Temple Reg #
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B1A1A] uppercase tracking-wide">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B1A1A] uppercase tracking-wide">
                      Gender
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B1A1A] uppercase tracking-wide">
                      Phone
                    </th>

                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B1A1A] uppercase tracking-wide">
                      Source
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B1A1A] uppercase tracking-wide whitespace-nowrap">
                      Created By
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B1A1A] uppercase tracking-wide whitespace-nowrap">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8B1A1A] uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#8B1A1A] uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E8D5C4]/60">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : profiles.length === 0 ? (

                    <tr>
                      <td colSpan={10} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Search size={36} className="text-[#E8D5C4]" />
                          <p className="font-semibold text-temple-brown/60">
                            No profiles found
                          </p>
                          <p className="text-xs text-temple-brown/40">
                            Try adjusting your search or filter criteria
                          </p>
                          {(search || statusFilter !== 'ALL' || genderFilter !== 'ALL' || hasActiveFilters) && (
                            <button
                              onClick={clearAllFilters}
                              className="text-xs text-[#8B1A1A] underline underline-offset-2 hover:no-underline mt-1"
                            >
                              Clear all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    profiles.map((profile) => {
                      const isSettled = profile.status === 'SETTLED';
                      const isSettling = settlingIds.has(profile.id);
                      return (
                        <tr
                          key={profile.id}
                          className="hover:bg-[#FFF8F0] transition-colors"
                        >
                          {/* Reg # */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-[#8B1A1A] bg-[#8B1A1A]/8 px-2 py-0.5 rounded">
                              {profile.registrationNumber}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-xs text-temple-brown/70">
                              {profile.internalRegistrationNo || "—"}
                            </span>
                          </td>

                          {/* Name */}
                          <td className="px-4 py-3">
                            <span className="font-semibold text-temple-brown">
                              {profile.fullName}
                            </span>
                          </td>

                          {/* Gender */}
                          <td className="px-4 py-3">
                            <GenderBadge gender={profile.gender} />
                          </td>

                          {/* Phone */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-temple-brown/70 font-mono text-xs">
                              {profile.guardianPhone}
                            </span>
                          </td>



                          {/* Source */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${(profile as any).registrationSource === 'OFFLINE'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-green-100 text-green-800 border border-green-200'
                              }`}>
                              {(profile as any).registrationSource === 'OFFLINE' ? 'Offline' : 'Online'}
                            </span>
                          </td>

                          {/* Created By */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {(profile as any).createdBy ? (() => {
                              const creator = (profile as any).createdBy as { name: string | null; role: string };
                              const initial = creator.name?.[0]?.toUpperCase() || '?';
                              const roleColor = creator.role === 'MANAGER' ? 'bg-emerald-500' : 'bg-blue-500';
                              const roleBadge = creator.role === 'MANAGER' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200';
                              return (
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-full ${roleColor} text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0`} title={creator.name || 'Staff'}>
                                    {initial}
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-temple-brown truncate max-w-[100px]">{creator.name || 'Staff'}</p>
                                    {/* <span className={`inline-flex items-center px-1.5 py-0 rounded text-[9px] font-semibold border ${roleBadge}`}>
                                  {creator.role}
                                </span> */}
                                  </div>
                                </div>
                              );
                            })() : (
                              <span className="text-gray-400 text-xs">Self-registered</span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3 whitespace-nowrap text-temple-brown/60 text-xs">
                            {new Date(profile.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            {/* Status Change */}
                            <StatusDropdown
                              profile={profile}
                              onStatusChange={handleStatusChange}
                            />
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => downloadBiodata(profile)}
                                title="Print biodata"
                                className="p-1.5 rounded-lg text-temple-brown/50 hover:text-green-600 hover:bg-green-50 transition-colors"
                                aria-label={`Print biodata of ${profile.fullName}`}
                              >
                                <Printer size={16} />
                              </button>

                              <button
                                onClick={() => printCard(profile)}
                                title="Print ID card"
                                className="p-1.5 rounded-lg text-temple-brown/50 hover:text-red-600 hover:bg-red-50 transition-colors"
                                aria-label={`Print ID card of ${profile.fullName}`}
                              >
                                <IdCard size={16} />
                              </button>

                              <button
                                onClick={() => setViewProfile(profile)}
                                title="View profile"
                                className="p-1.5 rounded-lg text-temple-brown/50 hover:text-[#8B1A1A] hover:bg-[#8B1A1A]/8 transition-colors"
                                aria-label={`View ${profile.fullName}`}
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                onClick={() => router.push(`/admin/register?edit=${profile.id}`)}
                                title="Edit profile"
                                className="p-1.5 rounded-lg text-temple-brown/50 hover:text-[#8B1A1A] hover:bg-[#8B1A1A]/8 transition-colors"
                                aria-label={`Edit ${profile.fullName}`}
                              >
                                <Edit2 size={16} />
                              </button>

                              <button
                                onClick={() => handleQuickToggleSettled(profile)}
                                disabled={isSettling}
                                title={isSettled ? 'Mark as Unsettled' : 'Mark as Settled'}
                                className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isSettled
                                  ? 'text-blue-600 hover:text-red-500 hover:bg-red-50'
                                  : 'text-temple-brown/50 hover:text-blue-600 hover:bg-blue-50'
                                  }`}
                                aria-label={isSettled ? `Unsettle ${profile.fullName}` : `Settle ${profile.fullName}`}
                              >
                                {isSettling ? (
                                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                                ) : isSettled ? (
                                  <XCircle size={16} />
                                ) : (
                                  <CheckCircle size={16} />
                                )}
                              </button>



                              {/* Delete */}
                              <button
                                onClick={() => setDeleteTarget(profile)}
                                title="Delete profile"
                                className="p-1.5 rounded-lg text-temple-brown/50 hover:text-red-600 hover:bg-red-50 transition-colors"
                                aria-label={`Delete ${profile.fullName}`}
                              >
                                <Trash2 size={16} />
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#E8D5C4] bg-[#FFF8F0]/50">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-temple-brown border border-[#E8D5C4] rounded-lg hover:bg-white hover:border-[#8B1A1A]/30 hover:text-[#8B1A1A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-[#E8D5C4] disabled:hover:text-temple-brown"
                >
                  <ChevronLeft size={15} />
                  Previous
                </button>

                <span className="text-sm text-temple-brown/60 font-medium">
                  Page{' '}
                  <span className="text-[#8B1A1A] font-semibold">{currentPage}</span>
                  {' '}of{' '}
                  <span className="text-[#8B1A1A] font-semibold">{totalPages}</span>
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-temple-brown border border-[#E8D5C4] rounded-lg hover:bg-white hover:border-[#8B1A1A]/30 hover:text-[#8B1A1A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-[#E8D5C4] disabled:hover:text-temple-brown"
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>
            )}

            {/* Single page footer count */}
            {!loading && totalPages <= 1 && total > 0 && (
              <div className="px-4 py-3 border-t border-[#E8D5C4] bg-[#FFF8F0]/50 text-xs text-temple-brown/50 text-center">
                {total} profile{total !== 1 ? 's' : ''} total
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Profile Detail Modal ── */}
      {viewProfile && (
        <ViewModal
          profile={viewProfile}
          onClose={() => setViewProfile(null)}
          showContactDetails={true}
        />
      )}

      {/* ── Delete Confirm Dialog ── */}
      {deleteTarget && (
        <DeleteConfirmDialog
          profile={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
