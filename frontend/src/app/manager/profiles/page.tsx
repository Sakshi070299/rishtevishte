'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
  AlertTriangle,
  UserCircle,
  Briefcase,
} from 'lucide-react';
import { teamApi, getUser, isAuthenticated, clearAuth, resolvePhotoUrl } from '@/lib/api';
import type { Profile, ProfileStatus, Gender } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'ALL' | ProfileStatus;
type GenderFilter = 'ALL' | Gender;

interface ProfilesResponse {
  data: Profile[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_LIMIT  = 15;
const DEBOUNCE_MS = 400;
const EMERALD     = '#059669';

// Managers can see ALL statuses including INACTIVE
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL',             label: 'All Statuses'     },
  { value: 'ACTIVE',          label: 'Active'           },
  { value: 'PENDING_PAYMENT', label: 'Pending Payment'  },
  { value: 'SETTLED',         label: 'Settled'          },
  { value: 'INACTIVE',        label: 'Inactive'         },
];

const GENDER_OPTIONS: { value: GenderFilter; label: string }[] = [
  { value: 'ALL',   label: 'All Genders' },
  { value: 'BRIDE', label: 'Bride'       },
  { value: 'GROOM', label: 'Groom'       },
];

// ─── Badge helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProfileStatus }) {
  const styles: Record<ProfileStatus, string> = {
    ACTIVE:          'bg-green-100 text-green-700 ring-1 ring-green-200',
    PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200',
    SETTLED:         'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    INACTIVE:        'bg-red-100 text-red-700 ring-1 ring-red-200',
  };
  const labels: Record<ProfileStatus, string> = {
    ACTIVE:          'Active',
    PENDING_PAYMENT: 'Pending Payment',
    SETTLED:         'Settled',
    INACTIVE:        'Inactive',
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
    BRIDE: 'bg-pink-100 text-pink-700 ring-1 ring-pink-200',
    GROOM: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[gender]}`}
    >
      {gender === 'BRIDE' ? 'Bride' : 'Groom'}
    </span>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-3.5 w-20 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="w-8 h-8 rounded-full bg-gray-200" /></td>
      <td className="px-4 py-3"><div className="h-3.5 w-32 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3"><div className="h-5 w-14 bg-gray-200 rounded-full" /></td>
      <td className="px-4 py-3"><div className="h-3.5 w-24 bg-gray-200 rounded font-mono" /></td>
      <td className="px-4 py-3"><div className="h-5 w-20 bg-gray-200 rounded-full" /></td>
      <td className="px-4 py-3"><div className="h-3.5 w-20 bg-gray-200 rounded" /></td>
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

// ─── Settle confirm dialog ────────────────────────────────────────────────────

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
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const action = targetSettled ? 'Settle' : 'Unsettle';
  const description = targetSettled
    ? 'This will mark the profile as SETTLED, indicating the match has been found.'
    : 'This will revert the profile from SETTLED back to ACTIVE.';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-emerald-100 p-6">
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              targetSettled ? 'bg-emerald-50' : 'bg-yellow-50'
            }`}
          >
            <AlertTriangle
              size={20}
              className={targetSettled ? 'text-emerald-600' : 'text-yellow-600'}
            />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 text-base mb-1">{action} Profile</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to{' '}
              <span className="font-medium text-gray-800 lowercase">{action}</span>{' '}
              <span className="font-semibold text-gray-900">{profile.fullName}</span>{' '}
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
            className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2 ${
              targetSettled
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-yellow-600 hover:bg-yellow-700'
            }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {targetSettled ? <CheckCircle size={14} /> : <XCircle size={14} />}
                Confirm {action}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile detail modal ─────────────────────────────────────────────────────

function ProfileDetailModal({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const Field = ({
    label,
    value,
  }: {
    label: string;
    value: string | number | boolean | null | undefined;
  }) => {
    if (value === null || value === undefined || value === '') return null;
    const display =
      typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
    return (
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide leading-none">
          {label}
        </span>
        <span className="text-sm text-gray-800 font-medium break-words">{display}</span>
      </div>
    );
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-3 pb-1.5 border-b border-emerald-100">
      {title}
    </h3>
  );

  const initials = profile.fullName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
  const fullPhotoUrl = resolvePhotoUrl(profile.photoUrl);
  console.log(fullPhotoUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-emerald-100">

        {/* Modal header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-emerald-100 rounded-t-2xl flex-shrink-0"
          style={{ background: `linear-gradient(to right, ${EMERALD}, #047857)` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {fullPhotoUrl ? (
              <img
                src={fullPhotoUrl}
                alt={profile.fullName}
                className="w-10 h-10 rounded-full object-cover border-2 border-white/30 flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-white font-bold text-base leading-tight truncate">
                {profile.fullName}
              </h2>
              <p className="text-emerald-200 text-xs mt-0.5 font-mono">
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

        {/* Status + gender strip */}
        <div className="flex items-center gap-2.5 px-6 py-3 bg-emerald-50/50 border-b border-emerald-100 flex-shrink-0">
          <StatusBadge status={profile.status} />
          <GenderBadge gender={profile.gender} />
          {fullPhotoUrl && (
            <a
              href={fullPhotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-emerald-600 hover:underline font-medium"
            >
              View full photo
            </a>
          )}
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Basic Info */}
          <section>
            <SectionHeader title="Basic Information" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <Field label="Full Name" value={profile.fullName} />
              <Field
                label="Date of Birth"
                value={
                  profile.dateOfBirth
                    ? new Date(profile.dateOfBirth).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })
                    : null
                }
              />
              <Field label="Birth Time" value={profile.birthTime} />
              <Field label="Birth Place" value={profile.birthPlace} />
              <Field label="Height" value={profile.height} />
              <Field label="Weight" value={profile.weight} />
              <Field label="Blood Group" value={profile.bloodGroup} />
              <Field label="Complexion" value={profile.complexion} />
              <Field label="Manglik Status" value={profile.manglikStatus?.replace(/_/g, ' ')} />
              <Field label="Marriage Status" value={profile.marriageStatus?.replace(/_/g, ' ')} />
              <Field
                label="Glasses"
                value={
                  profile.glassesType === 'OCCASIONALLY'
                    ? 'Occasionally'
                    : profile.glassesType === 'YES'
                      ? 'Yes'
                      : profile.glassesType === 'NO'
                        ? 'No'
                        : profile.glasses
                          ? 'Yes'
                          : 'No'
                }
              />
              {profile.disability && (
                <Field label="Disability Details" value={profile.disabilityDetails ?? 'Yes'} />
              )}
            </div>
          </section>

          {/* Education & Work */}
          <section>
            <SectionHeader title="Education & Work" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <Field label="Education" value={profile.education} />
              <Field label="Profession" value={profile.profession?.replace(/_/g, ' ')} />
              <Field label="Profession Details" value={profile.professionDetails} />
              <Field
                label="Monthly Income"
                value={
                  profile.monthlyIncome !== null && profile.monthlyIncome !== undefined
                    ? `\u20B9${profile.monthlyIncome.toLocaleString('en-IN')}`
                    : null
                }
              />
              <Field label="Diet" value={profile.diet} />
              <Field label="Health Status" value={profile.healthStatus} />
            </div>
          </section>

          {/* Family */}
          <section>
            <SectionHeader title="Family Details" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <Field label="Father's Name" value={profile.fatherName} />
              <Field label="Mother's Name" value={profile.motherName} />
              <Field label="Guardian Phone" value={profile.guardianPhone} />
              <Field label="Guardian Email" value={profile.guardianEmail} />
              <Field
                label="Brothers (M/U)"
                value={`${profile.marriedBrothers} married, ${profile.unmarriedBrothers} unmarried`}
              />
              <Field
                label="Sisters (M/U)"
                value={`${profile.marriedSisters} married, ${profile.unmarriedSisters} unmarried`}
              />
            </div>
          </section>

          {/* Address */}
          <section>
            <SectionHeader title="Address" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <Field label="Address" value={profile.address} />
              <Field label="Religion" value={profile.religion} />
              <Field label="Caste" value={profile.caste} />
              <Field label="City" value={profile.city} />
              <Field label="State" value={profile.state} />
              <Field label="Pincode" value={profile.pincode} />
            </div>
          </section>

          {/* Property */}
          {(profile.house ?? profile.business ?? profile.otherProperty) && (
            <section>
              <SectionHeader title="Property" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                <Field label="House" value={profile.house} />
                <Field label="Business" value={profile.business} />
                <Field label="Other Property" value={profile.otherProperty} />
              </div>
            </section>
          )}

          {/* Preferences */}
          {(profile.preferredCaste ??
            profile.preferredAgeMin ??
            profile.preferredLocation ??
            profile.partnerPreference ??
            profile.partnerPreferenceDetails) && (
            <section>
              <SectionHeader title="Partner Preferences" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                <Field label="Preferred Caste" value={profile.preferredCaste} />
                <Field
                  label="Preferred Age Range"
                  value={
                    profile.preferredAgeMin !== null && profile.preferredAgeMax !== null
                      ? `${profile.preferredAgeMin}\u2013${profile.preferredAgeMax} yrs`
                      : null
                  }
                />
                <Field label="Preferred Location" value={profile.preferredLocation} />
                <Field label="Preference (वरीयता)" value={profile.partnerPreference} />
                <Field label="Preference Details (वरीयता विवरण)" value={profile.partnerPreferenceDetails} />
              </div>
            </section>
          )}

          {/* Meta */}
          <section>
            <SectionHeader title="Registration Info" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <Field label="Registration #" value={profile.registrationNumber} />
              <Field
                label="Registered On"
                value={new Date(profile.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              />
              <Field
                label="Last Updated"
                value={new Date(profile.updatedAt).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              />
            </div>
          </section>
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t border-emerald-100 flex justify-end flex-shrink-0 bg-gray-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold border rounded-lg transition-colors"
            style={{ color: EMERALD, borderColor: EMERALD }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = EMERALD;
              (e.currentTarget as HTMLButtonElement).style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = EMERALD;
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ManagerProfilesPage() {
  const router = useRouter();

  // ── Auth guard ──
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/auth?type=MANAGER');
      return;
    }
    const user = getUser();
    if (user?.role !== 'MANAGER' && user?.role !== 'ADMIN') {
      router.push('/auth?type=MANAGER');
    }
  }, [router]);

  // ── Data state ──
  const [profiles, setProfiles]     = useState<Profile[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading]       = useState(true);

  // ── Filter state ──
  const [searchInput, setSearchInput]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('ALL');
  const [genderFilter, setGenderFilter]     = useState<GenderFilter>('ALL');

  // ── Modal / dialog state ──
  const [viewProfile, setViewProfile]   = useState<Profile | null>(null);
  const [settleTarget, setSettleTarget] = useState<{
    profile: Profile;
    targetSettled: boolean;
  } | null>(null);
  const [settleLoading, setSettleLoading] = useState(false);
  const [settlingIds, setSettlingIds]     = useState<Set<string>>(new Set());

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Debounce search input ──
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchInput]);

  // ── Reset page on filter change ──
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, genderFilter]);

  // ── Fetch profiles ──
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const parts: string[] = [`page=${currentPage}`, `limit=${PAGE_LIMIT}`];
      if (debouncedSearch.trim()) {
        parts.push(`search=${encodeURIComponent(debouncedSearch.trim())}`);
      }
      if (statusFilter !== 'ALL') parts.push(`status=${statusFilter}`);
      if (genderFilter !== 'ALL') parts.push(`gender=${genderFilter}`);

      const result = (await teamApi.searchProfiles(parts.join('&'))) as ProfilesResponse;
      setProfiles(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load profiles';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, statusFilter, genderFilter]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // ── Toggle settled ──
  const initiateToggleSettled = (profile: Profile) => {
    const currentlySettled = profile.status === 'SETTLED';
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
          : `${profile.fullName} reverted to Active`
      );
      setSettleTarget(null);
      await fetchProfiles();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
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

  // ── Pagination helpers ──
  const startItem     = total === 0 ? 0 : (currentPage - 1) * PAGE_LIMIT + 1;
  const endItem       = Math.min(currentPage * PAGE_LIMIT, total);
  const hasActiveFilters =
    searchInput.trim() !== '' || statusFilter !== 'ALL' || genderFilter !== 'ALL';

  const clearFilters = () => {
    setSearchInput('');
    setStatusFilter('ALL');
    setGenderFilter('ALL');
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Page header ── */}
      <header
        className="px-6 py-4 shadow-md"
        style={{ background: `linear-gradient(to right, ${EMERALD}, #047857)` }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Briefcase size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-base leading-tight">
                Profile Management
              </h1>
              <p className="text-emerald-200 text-xs mt-0.5 font-hindi">
                मैनेजर पैनल — रिश्तेसेतु
              </p>
            </div>
          </div>
          {/* <button
            onClick={() => {
              clearAuth();
              router.push('/');
            }}
            className="flex items-center gap-2 text-sm text-emerald-100 hover:text-white bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            <span className="hidden sm:inline">Logout</span>
          </button> */}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Manager access note */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium mb-5"
          style={{
            backgroundColor: '#ECFDF5',
            borderColor: '#6EE7B7',
            color: '#047857',
          }}
        >
          <Briefcase size={14} style={{ color: EMERALD }} />
          Full access — including INACTIVE profiles.
        </div>

        {/* ── Search & filter bar ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="flex flex-col sm:flex-row gap-3">

            {/* Search input */}
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name, mobile, registration number..."
                className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-800 placeholder:text-gray-400 focus:outline-none transition-all"
                style={{ '--tw-ring-color': EMERALD } as React.CSSProperties}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = EMERALD;
                  e.currentTarget.style.boxShadow = `0 0 0 3px rgba(5,150,105,0.12)`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Filter size={15} className="text-gray-400 flex-shrink-0" />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-700 focus:outline-none cursor-pointer transition-all"
                onFocus={(e) => { e.currentTarget.style.borderColor = EMERALD; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as GenderFilter)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-700 focus:outline-none cursor-pointer transition-all"
                onFocus={(e) => { e.currentTarget.style.borderColor = EMERALD; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                aria-label="Filter by gender"
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Results summary + clear */}
          <div className="flex items-center justify-between mt-3">
            {!loading ? (
              <p className="text-xs text-gray-400">
                {total === 0
                  ? 'No profiles found'
                  : `Showing ${startItem}\u2013${endItem} of ${total} profile${total !== 1 ? 's' : ''}`}
              </p>
            ) : (
              <p className="text-xs text-gray-400">Loading...</p>
            )}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-medium hover:underline underline-offset-2"
                style={{ color: EMERALD }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── Data table ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-gray-200"
                  style={{ backgroundColor: 'rgba(5,150,105,0.05)' }}
                >
                  {[
                    { label: 'Reg #',   align: 'left'  },
                    { label: 'Photo',   align: 'left'  },
                    { label: 'Name',    align: 'left'  },
                    { label: 'Gender',  align: 'left'  },
                    { label: 'Phone',   align: 'left'  },
                    { label: 'Status',  align: 'left'  },
                    { label: 'Date',    align: 'left'  },
                    { label: 'Actions', align: 'right' },
                  ].map(({ label, align }) => (
                    <th
                      key={label}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap text-${align}`}
                      style={{ color: EMERALD }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : profiles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Search size={40} className="text-gray-200" />
                        <p className="font-semibold text-gray-500">No profiles found</p>
                        <p className="text-xs text-gray-400">
                          Try adjusting your search or filter criteria
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={clearFilters}
                            className="text-xs underline underline-offset-2 hover:no-underline mt-1"
                            style={{ color: EMERALD }}
                          >
                            Clear all filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  profiles.map((profile) => {
                    const isSettled  = profile.status === 'SETTLED';
                    const isSettling = settlingIds.has(profile.id);

                    return (
                      <tr
                        key={profile.id}
                        className="hover:bg-emerald-50/30 transition-colors group"
                      >
                        {/* Reg # */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className="font-mono text-xs font-semibold px-2 py-0.5 rounded"
                            style={{ color: EMERALD, backgroundColor: '#ECFDF5' }}
                          >
                            {profile.registrationNumber}
                          </span>
                        </td>

                        {/* Photo */}
                        <td className="px-4 py-3">
                          {resolvePhotoUrl(profile.photoUrl) ? (
                            <img
                              src={resolvePhotoUrl(profile.photoUrl)}
                              alt={profile.fullName}
                              className="w-8 h-8 rounded-full object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                              <UserCircle size={18} className="text-emerald-300" />
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
                          <StatusBadge status={profile.status} />
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-xs">
                          {new Date(profile.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">

                            {/* View */}
                            <button
                              onClick={() => setViewProfile(profile)}
                              title="View full profile"
                              aria-label={`View profile of ${profile.fullName}`}
                              className="p-1.5 rounded-lg text-gray-400 transition-colors"
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.color = EMERALD;
                                (e.currentTarget as HTMLElement).style.backgroundColor = '#ECFDF5';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.color = '#9ca3af';
                                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                              }}
                            >
                              <Eye size={16} />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => router.push(`/manager/register?edit=${profile.id}`)}
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
                              title={isSettled ? 'Mark as Unsettled' : 'Mark as Settled'}
                              aria-label={
                                isSettled
                                  ? `Unsettle ${profile.fullName}`
                                  : `Settle ${profile.fullName}`
                              }
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                isSettled
                                  ? 'text-emerald-600 hover:text-red-500 hover:bg-red-50'
                                  : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onMouseEnter={(e) => {
                  if (currentPage !== 1) {
                    (e.currentTarget as HTMLElement).style.borderColor = EMERALD;
                    (e.currentTarget as HTMLElement).style.color = EMERALD;
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb';
                  (e.currentTarget as HTMLElement).style.color = '#4b5563';
                }}
              >
                <ChevronLeft size={15} />
                Previous
              </button>

              <span className="text-sm text-gray-500 font-medium">
                Page{' '}
                <span className="font-semibold" style={{ color: EMERALD }}>{currentPage}</span>
                {' '}of{' '}
                <span className="font-semibold" style={{ color: EMERALD }}>{totalPages}</span>
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                onMouseEnter={(e) => {
                  if (currentPage !== totalPages) {
                    (e.currentTarget as HTMLElement).style.borderColor = EMERALD;
                    (e.currentTarget as HTMLElement).style.color = EMERALD;
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb';
                  (e.currentTarget as HTMLElement).style.color = '#4b5563';
                }}
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* Single-page footer count */}
          {!loading && totalPages <= 1 && total > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-400 text-center">
              {total} profile{total !== 1 ? 's' : ''} total
            </div>
          )}
        </div>
      </div>

      {/* ── Profile detail modal ── */}
      {viewProfile && (
        <ProfileDetailModal
          profile={viewProfile}
          onClose={() => setViewProfile(null)}
        />
      )}

      {/* ── Settle / unsettle confirm dialog ── */}
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
