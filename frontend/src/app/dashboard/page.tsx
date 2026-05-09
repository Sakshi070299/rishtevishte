"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  UserPlus,
  Search,
  Heart,
  FileText,
  Users,
  Eye,
  Pencil,
  FileDown,
  CreditCard,
  XCircle,
  IndianRupee,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  User,
} from "lucide-react";
import {
  profilesApi,
  searchApi,
  contentApi,
  getUser,
  resolvePhotoUrl,
} from '@/lib/api';
import { useDashboardNavProfiles } from '@/app/dashboard/dashboard-nav-profiles-context';
import type { Profile, WeeklyLimitInfo } from '@/types';
import Image from "next/image";
import { downloadBiodata, printCard } from "@/lib/download-biodata";

// ─── CONSTANTS ───────────────────────────────────────────

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const EXPIRY_WARNING_DAYS = 30;

// ─── HELPERS ─────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function age(dob: string) {
  return Math.floor(
    (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

function daysUntil(dateStr: string): number {
  return Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

function todayFormatted(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── STATUS BADGE ────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  ACTIVE: {
    label: "Active",
    classes: "bg-green-100 text-green-700 border-green-200",
  },
  PENDING_PAYMENT: {
    label: "Pending Payment",
    classes: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  SETTLED: {
    label: "Settled",
    classes: "bg-blue-100 text-blue-700 border-blue-200",
  },
  INACTIVE: {
    label: "Inactive",
    classes: "bg-red-100 text-red-600 border-red-200",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    classes: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── COMPLETION BAR ──────────────────────────────────────

function CompletionBar({ pct }: { pct: number }) {
  const color =
    pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-400" : "bg-red-500";

  const textColor =
    pct >= 70
      ? "text-green-700"
      : pct >= 40
        ? "text-amber-700"
        : "text-red-600";

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-temple-brown-light">
          Profile Completion
        </span>
        <span className={`text-xs font-semibold ${textColor}`}>{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-[#E8D5C4] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── SKELETON COMPONENTS ──────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-5 border border-[#E8D5C4] animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-200" />
        <div className="h-4 bg-gray-200 rounded w-24" />
      </div>
      <div className="h-8 bg-gray-200 rounded w-12 mb-1" />
      <div className="h-3 bg-gray-100 rounded w-20" />
    </div>
  );
}

function ProfileCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[#E8D5C4] p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-16 h-20 rounded-lg bg-gray-200 shrink-0" />
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="h-5 bg-gray-200 rounded w-36 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-24" />
            </div>
            <div className="h-5 bg-gray-200 rounded-full w-20" />
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full mt-4" />
          <div className="flex gap-2 mt-4 pt-3 border-t border-[#E8D5C4]">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 bg-gray-100 rounded-lg w-20" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TERMS MODAL ─────────────────────────────────────────

function TermsModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contentApi
      .get("terms_and_conditions")
      .then((data) => setContent(data.content))
      .catch(() =>
        setContent(
          "<p>Unable to load terms and conditions. Please try again later.</p>",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8D5C4] shrink-0">
          <div>
            <h3 className="font-bold text-maroon text-lg">
              Terms &amp; Conditions
            </h3>
            <p className="font-hindi text-xs text-primary">नियम और शर्तें</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-cream-dark text-temple-brown-light hover:text-maroon transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          ) : (
            <div
              className="ql-editor prose prose-sm max-w-none text-temple-brown leading-relaxed"
              dangerouslySetInnerHTML={{ __html: content ?? "" }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E8D5C4] shrink-0">
          <button
            onClick={onClose}
            className="btn-primary text-sm px-5 py-2.5 w-full justify-center"
          >
            <CheckCircle2 size={15} />I Understand
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DEACTIVATE CONFIRM DIALOG ───────────────────────────

function DeactivateDialog({
  profileName,
  onConfirm,
  onCancel,
  loading,
}: {
  profileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <XCircle size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-temple-brown">Deactivate Profile?</h3>
            <p className="text-xs text-temple-brown-light">
              This action can be reversed by the temple team.
            </p>
          </div>
        </div>
        <p className="text-sm text-temple-brown-light mb-6">
          Are you sure you want to deactivate{" "}
          <strong className="text-temple-brown">{profileName}</strong>? The
          profile will no longer appear in search results.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#E8D5C4] text-sm font-medium text-temple-brown hover:bg-cream-dark transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <XCircle size={14} />
            )}
            {loading ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PROFILE CARD ────────────────────────────────────────

interface ProfileCardProps {
  profile: ProfileWithMeta;
  onDeactivate: (id: string, name: string) => void;
}



function ProfileCard({ profile, onDeactivate }: ProfileCardProps) {
  const isActive = profile.status === "ACTIVE";
  const isSettled = profile.status === "SETTLED";
  const isPending = profile.status === "PENDING_PAYMENT";

  return (
    <div
      className={`bg-white rounded-xl border p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 ${isSettled ? "border-blue-200 bg-blue-50/20" : "border-[#E8D5C4]"
        }`}
    >
      <div className="flex items-start gap-4">
        {/* Photo */}
        <div className="shrink-0">
          {resolvePhotoUrl(profile.photoUrl) ? (
            <img
              src={resolvePhotoUrl(profile.photoUrl)}
              alt={profile.fullName}
              className="w-16 h-20 rounded-lg object-cover border-2 border-gold"
            />
          ) : (
            <div className="w-16 h-20 rounded-lg bg-cream-dark border-2 border-[#E8D5C4] flex items-center justify-center">
              <User size={24} className="text-temple-brown-light opacity-50" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <h3 className="font-bold text-temple-brown truncate">
                {profile.fullName}
              </h3>
              <p className="text-xs text-temple-brown-light">
                {profile.registrationNumber}
              </p>
            </div>
            <StatusBadge status={profile.status} />
          </div>

          {/* Expiry */}
          {profile.expiresAt && (
            <p className="text-xs text-temple-brown-light flex items-center gap-1 mt-0.5">
              <CalendarDays size={11} />
              Valid until: {fmtDate(profile.expiresAt)}
              {daysUntil(profile.expiresAt) <= EXPIRY_WARNING_DAYS &&
                daysUntil(profile.expiresAt) > 0 && (
                  <span className="text-amber-600 font-semibold ml-1">
                    ({daysUntil(profile.expiresAt)}d left)
                  </span>
                )}
            </p>
          )}

          {/* Completion bar */}
          <CompletionBar pct={profile.completionPct} />
        </div>
      </div>
      {/* Action buttons */}
      <div className="mt-4 pt-3 border-t border-[#E8D5C4] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max min-w-full flex-nowrap justify-end gap-2 [&>*]:shrink-0">
          {/* Edit */}
          {isSettled ? (
            <span
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed select-none"
              title="Settled profiles cannot be edited"
            >
              <Pencil size={12} /> Edit
            </span>
          ) : (
            <Link
              href={`/register?edit=${profile.id}`}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition-colors"
            >
              <Pencil size={12} /> Edit
            </Link>
          )}

          {/* Download Biodata */}
          {profile.status === "SETTLED" && (
            <button
              type="button"
              onClick={() => downloadBiodata(profile)}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-600 font-medium hover:bg-green-100 transition-colors"
            >
              <FileDown size={12} /> Biodata
            </button>
          )}
          {/* Print Card */}
          {profile.status === "SETTLED" && (
            <button
              type="button"
              onClick={() => printCard(profile)}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-maroon/10 text-maroon font-medium hover:bg-maroon/20 transition-colors"
            >
              <CreditCard size={12} /> Print Card
            </button>
          )}

          {/* Deactivate — only for ACTIVE */}
          {isActive && (
            <button
              onClick={() => onDeactivate(profile.id, profile.fullName)}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors ml-auto"
            >
              <XCircle size={12} /> Deactivate
            </button>
          )}

          {/* Pay — only for PENDING_PAYMENT */}
          {isPending && (
            <Link
              href="/profiles"
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 font-semibold hover:bg-yellow-100 transition-colors"
            >
              <IndianRupee size={12} /> Pay Now
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────

interface ProfileWithMeta extends Profile {
  completionPct: number;
  expiresAt?: string;
}

interface DeactivateState {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const user = getUser();
  const userName = user?.name || user?.mobile || "User";
  const { myProfileCount, myProfilesLoading, refreshMyProfiles } =
    useDashboardNavProfiles();
  const atProfileLimit =
    !myProfilesLoading &&
    myProfileCount !== null &&
    myProfileCount >= 1;

  const [profiles, setProfiles] = useState<ProfileWithMeta[]>([]);
  const [weeklyInfo, setWeeklyInfo] = useState<WeeklyLimitInfo | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingWeekly, setLoadingWeekly] = useState(true);

  const [termsOpen, setTermsOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<DeactivateState | null>(
    null,
  );
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // ── Fetch profiles ──────────────────────────────────
  const fetchProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const raw = (await profilesApi.list()) as ProfileWithMeta[];
      // Back-fill completionPct / expiresAt if API doesn't return them yet
      const normalised: ProfileWithMeta[] = raw.map((p) => ({
        ...p,
        completionPct:
          typeof p.completionPct === "number"
            ? p.completionPct
            : deriveCompletionPct(p),
        expiresAt: p.expiresAt ?? undefined,
      }));
      setProfiles(normalised);
      await refreshMyProfiles();
    } catch {
      toast.error("Failed to load profiles");
    } finally {
      setLoadingProfiles(false);
    }
  }, [refreshMyProfiles]);

  // ── Fetch weekly remaining ──────────────────────────
  useEffect(() => {
    setLoadingWeekly(true);
    searchApi
      .remaining()
      .then((data) => setWeeklyInfo(data as WeeklyLimitInfo))
      .catch(() => {
        /* non-fatal */
      })
      .finally(() => setLoadingWeekly(false));

    fetchProfiles();
  }, [fetchProfiles]);

  // ── Derived stats ───────────────────────────────────
  const totalProfiles = profiles.length;
  const activeProfiles = profiles.filter((p) => p.status === "ACTIVE").length;
  const avgCompletion = totalProfiles
    ? Math.round(
      profiles.reduce((sum, p) => sum + p.completionPct, 0) / totalProfiles,
    )
    : 0;

  // ── Expiry warnings ─────────────────────────────────
  const expiringProfiles = profiles.filter(
    (p) =>
      p.expiresAt &&
      daysUntil(p.expiresAt) <= EXPIRY_WARNING_DAYS &&
      daysUntil(p.expiresAt) > 0,
  );

  // ── Deactivate handler ──────────────────────────────
  const handleDeactivateConfirm = async () => {
    if (!deactivating) return;
    setDeactivateLoading(true);
    try {
      await profilesApi.deactivate(deactivating.id);
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === deactivating.id ? { ...p, status: "INACTIVE" } : p,
        ),
      );
      toast.success(`${deactivating.name} has been deactivated.`);
      setDeactivating(null);
      await refreshMyProfiles();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to deactivate profile";
      toast.error(msg);
    } finally {
      setDeactivateLoading(false);
    }
  };

  return (
    <>
      {/* ── Welcome Banner ─────────────────────────────── */}
      <div className="bg-gradient-to-r from-maroon to-primary rounded-2xl p-6 sm:p-8 text-white mb-8">
        <div className="flex items-start gap-4">
          <span className="mt-1 shrink-0 inline-flex">
            <Image
              className="size-12"
              src={"/icons/om-icon-v2.png"}
              width={40}
              height={40}
              alt="om-logo"
            />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold leading-tight">
              Welcome back, {userName}
            </h2>
            <p className="font-hindi text-gold-light text-sm mt-0.5">
              बजरंगबली के आशीर्वाद से आपका स्वागत है
            </p>
            <p className="text-white/70 text-xs mt-2 flex items-center gap-1.5">
              <CalendarDays size={13} />
              {todayFormatted()}
            </p>
          </div>
        </div>
      </div>

      {/* ── Expiry Warning Banner ───────────────────────── */}
      {!loadingProfiles && expiringProfiles.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Profile Expiry Notice
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {expiringProfiles.length === 1
                ? `"${expiringProfiles[0].fullName}" expires in ${daysUntil(expiringProfiles[0].expiresAt!)} day(s). Please contact the temple to renew.`
                : `${expiringProfiles.length} of your profiles are expiring within ${EXPIRY_WARNING_DAYS} days. Please contact the temple office to renew.`}
            </p>
          </div>
        </div>
      )}

      {/* ── Stats Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* My Profiles */}
        <div className="bg-white rounded-xl p-3.5 sm:p-5 border border-[#E8D5C4] shadow-sm">
          {loadingProfiles ? (
            <StatCardSkeleton />
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users size={18} className="text-primary" />
                </div>
                <p className="text-xs font-medium text-temple-brown-light leading-tight">
                  My Profiles
                </p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-temple-brown">
                {totalProfiles}
              </p>
              <p className="font-hindi text-xs text-primary mt-0.5">
                मेरे प्रोफाइल
              </p>
            </>
          )}
        </div>

        {/* Weekly Views Left */}
        <div className="bg-white rounded-xl p-3.5 sm:p-5 border border-[#E8D5C4] shadow-sm">
          {loadingWeekly ? (
            <StatCardSkeleton />
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-maroon/10 flex items-center justify-center shrink-0">
                  <Eye size={18} className="text-maroon" />
                </div>
                <p className="text-xs font-medium text-temple-brown-light leading-tight">
                  Weekly Views Left
                </p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-maroon">
                {weeklyInfo ? weeklyInfo.remaining : "—"}
              </p>
              <p className="font-hindi text-xs text-primary mt-0.5">
                {weeklyInfo
                  ? `${weeklyInfo.viewed} / ${weeklyInfo.limit} used`
                  : "साप्ताहिक दर्शन"}
              </p>
            </>
          )}
        </div>

        {/* Active Profiles */}
        <div className="bg-white rounded-xl p-3.5 sm:p-5 border border-[#E8D5C4] shadow-sm">
          {loadingProfiles ? (
            <StatCardSkeleton />
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} className="text-green-600" />
                </div>
                <p className="text-xs font-medium text-temple-brown-light leading-tight">
                  Active Profiles
                </p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-green-600">
                {activeProfiles}
              </p>
              <p className="font-hindi text-xs text-primary mt-0.5">
                सक्रिय प्रोफाइल
              </p>
            </>
          )}
        </div>

        {/* Profile Completion */}
        <div className="bg-white rounded-xl p-3.5 sm:p-5 border border-[#E8D5C4] shadow-sm">
          {loadingProfiles ? (
            <StatCardSkeleton />
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-gold/20 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-gold" />
                </div>
                <p className="text-xs font-medium text-temple-brown-light leading-tight">
                  Avg. Completion
                </p>
              </div>
              <p
                className={`text-2xl sm:text-3xl font-bold ${avgCompletion >= 70
                  ? "text-green-600"
                  : avgCompletion >= 40
                    ? "text-amber-600"
                    : "text-red-600"
                  }`}
              >
                {totalProfiles ? `${avgCompletion}%` : "—"}
              </p>
              <p className="font-hindi text-xs text-primary mt-0.5">
                प्रोफाइल पूर्णता
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── My Profiles List ────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-maroon">My Profiles</h2>
            <p className="font-hindi text-xs text-primary">
              मेरे पंजीकृत प्रोफाइल
            </p>
          </div>
          {!atProfileLimit && profiles.length < 1 && (
            <Link
              href="/register"
              className="text-xs font-semibold text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
            >
              <UserPlus size={14} /> Add New
            </Link>
          )}
        </div>

        {loadingProfiles ? (
          <div className="space-y-4">
            <ProfileCardSkeleton />
            <ProfileCardSkeleton />
          </div>
        ) : profiles.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8D5C4] p-10 text-center">
            <User
              size={40}
              className="mx-auto text-temple-brown-light opacity-30 mb-3"
            />
            <h3 className="font-semibold text-temple-brown mb-1">
              No Profiles Yet
            </h3>
            <p className="text-sm text-temple-brown-light mb-4">
              Register a bride or groom profile to get started.
            </p>
            {!atProfileLimit && (
              <Link href="/register" className="btn-primary text-sm px-5 py-2.5">
                <UserPlus size={15} /> Create Profile
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onDeactivate={(id, name) => setDeactivating({ id, name })}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Quick Actions ────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-maroon">Quick Actions</h2>
          <p className="font-hindi text-xs text-primary">त्वरित क्रियाएं</p>
        </div>
        <div
          className={`grid grid-cols-2 gap-4 ${atProfileLimit ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}
        >
          {!atProfileLimit && (
            <Link
              href="/register"
              className="card-temple group flex flex-col items-center text-center p-5"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-white transition-all duration-200">
                <UserPlus size={20} />
              </div>
              <p className="text-sm font-semibold text-temple-brown">
                New Registration
              </p>
              <p className="font-hindi text-xs text-primary mt-0.5">
                नया पंजीकरण
              </p>
            </Link>
          )}

          {/* Search Matches */}
          <Link
            href="/search"
            className="card-temple group flex flex-col items-center text-center p-5"
          >
            <div className="w-11 h-11 rounded-xl bg-green-100 text-green-600 flex items-center justify-center mb-3 group-hover:bg-green-600 group-hover:text-white transition-all duration-200">
              <Search size={20} />
            </div>
            <p className="text-sm font-semibold text-temple-brown">
              Search Matches
            </p>
            <p className="font-hindi text-xs text-primary mt-0.5">
              रिश्ते खोजें
            </p>
          </Link>

          {/* Donations */}
          <Link
            href="/donation"
            className="card-temple group flex flex-col items-center text-center p-5"
          >
            <div className="w-11 h-11 rounded-xl bg-gold/20 text-gold flex items-center justify-center mb-3 group-hover:bg-gold group-hover:text-white transition-all duration-200">
              <Heart size={20} />
            </div>
            <p className="text-sm font-semibold text-temple-brown">Donations</p>
            <p className="font-hindi text-xs text-primary mt-0.5">दान करें</p>
          </Link>

          {/* Terms & Conditions */}
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="card-temple group flex flex-col items-center text-center p-5 w-full"
          >
            <div className="w-11 h-11 rounded-xl bg-maroon/10 text-maroon flex items-center justify-center mb-3 group-hover:bg-maroon group-hover:text-white transition-all duration-200">
              <FileText size={20} />
            </div>
            <p className="text-sm font-semibold text-temple-brown">
              Terms &amp; Conditions
            </p>
            <p className="font-hindi text-xs text-primary mt-0.5">
              नियम और शर्तें
            </p>
          </button>
        </div>
      </section>

      {/* ── Modals ───────────────────────────────────────── */}
      {termsOpen && <TermsModal onClose={() => setTermsOpen(false)} />}

      {deactivating && (
        <DeactivateDialog
          profileName={deactivating.name}
          onConfirm={handleDeactivateConfirm}
          onCancel={() => !deactivateLoading && setDeactivating(null)}
          loading={deactivateLoading}
        />
      )}
    </>
  );
}

// ─── COMPLETION FALLBACK (if API omits completionPct) ────

function deriveCompletionPct(p: Profile): number {
  const fields: (keyof Profile)[] = [
    "fullName",
    "fatherName",
    "dateOfBirth",
    "manglikStatus",
    "marriageStatus",
    "profession",
    "guardianPhone",
    "photoUrl",
    "education",
    "height",
    "address",
    "city",
    "birthTime",
    "bloodGroup",
    "motherName",
    "preferredCaste",
    "partnerPreference",
    "partnerPreferenceDetails",
  ];

  const filled = fields.filter((k) => {
    const v = p[k];
    return v !== null && v !== undefined && v !== "";
  }).length;
  return Math.round((filled / fields.length) * 100);
}
