'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  IndianRupee,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ReceiptIndianRupee,
  Wallet,
  CircleAlert,
  SlidersHorizontal,
  User,
  CalendarDays,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { adminApi, isAuthenticated, getUser } from '@/lib/api';
import type { DonationType, PaginatedResponse } from '@/types';

// ─── Types ────────────────────────────────────────────────

type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

interface AdminDonation {
  id: string;
  type: DonationType;
  amount: number; // stored in paisa
  paymentStatus: PaymentStatus;
  donorName: string | null;
  isAnonymous?: boolean | null;
  donorMobile: string | null;
  gatewayPaymentId: string | null;
  paymentMethod?: 'ONLINE' | 'CASH' | 'FREE' | null;
  createdAt: string;
  splitPaymentMethods?: string[];
  splitCashRupees?: number | null;
  splitOnlineRupees?: number | null;
  splitFreeRupees?: number | null;
  splitFreeApprovedBy?: string | null;
  splitFreeReason?: string | null;
  profile: {
    fullName: string;
    registrationNumber: string;
  } | null;
  user?: {
    name: string | null;
    mobile: string | null;
  } | null;
}

interface DonationReport {
  totalCompleted: number;       // rupees
  registrationCompleted: number; // rupees
  generalCompleted: number;     // rupees
  pendingCount: number;
  failedCount: number;
  onlineRupees: number;
  offlineRupees: number;
  combinedRupees: number;
}

interface DonationReportApiResponse {
  totalCompleted?: number | string;
  registrationCompleted?: number | string;
  generalCompleted?: number | string;
  pendingCount?: number | string;
  failedCount?: number | string;
  grandTotal?: number | string; // rupees (reports API format)
  registration?: { totalAmount?: number | string }; // rupees
  general?: { totalAmount?: number | string }; // rupees
  summary?: {
    onlineRupees?: number | string;
    offlineRupees?: number | string;
    combinedRupees?: number | string;
  };
}

interface DonationsListResponse extends PaginatedResponse<AdminDonation> {
  summary?: {
    onlineRupees?: number;
    offlineRupees?: number;
    combinedRupees?: number;
  };
}

type TypeFilter = 'ALL' | DonationType;
type StatusFilter = 'ALL' | PaymentStatus;

const PAGE_LIMIT = 20;

// ─── Helpers ──────────────────────────────────────────────

function formatRupees(paisa: number): string {
  return (paisa / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatRupeesValue(rupees: number): string {
  return rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeDonationReport(raw: DonationReportApiResponse): DonationReport {
  if (raw.grandTotal !== undefined || raw.registration?.totalAmount !== undefined || raw.general?.totalAmount !== undefined) {
    return {
      totalCompleted: toNumber(raw.grandTotal),
      registrationCompleted: toNumber(raw.registration?.totalAmount),
      generalCompleted: toNumber(raw.general?.totalAmount),
      pendingCount: toNumber(raw.pendingCount),
      failedCount: toNumber(raw.failedCount),
      onlineRupees: toNumber(raw.summary?.onlineRupees),
      offlineRupees: toNumber(raw.summary?.offlineRupees),
      combinedRupees: toNumber(raw.summary?.combinedRupees),
    };
  }

  return {
    totalCompleted: toNumber(raw.totalCompleted),
    registrationCompleted: toNumber(raw.registrationCompleted),
    generalCompleted: toNumber(raw.generalCompleted),
    pendingCount: toNumber(raw.pendingCount),
    failedCount: toNumber(raw.failedCount),
    onlineRupees: toNumber(raw.summary?.onlineRupees),
    offlineRupees: toNumber(raw.summary?.offlineRupees),
    combinedRupees: toNumber(raw.summary?.combinedRupees),
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatOfflineSplit(d: AdminDonation): string | null {
  const methods = d.splitPaymentMethods?.filter(Boolean) ?? [];
  const bits: string[] = [];
  if (methods.length) bits.push(methods.join(' + '));
  if (d.splitCashRupees != null && d.splitCashRupees > 0) {
    bits.push(`Cash ₹${d.splitCashRupees.toLocaleString('en-IN')}`);
  }
  if (d.splitOnlineRupees != null && d.splitOnlineRupees > 0) {
    bits.push(`Online ₹${d.splitOnlineRupees.toLocaleString('en-IN')}`);
  }
  if (d.splitFreeRupees != null && d.splitFreeRupees > 0) {
    bits.push(`Waived ₹${d.splitFreeRupees.toLocaleString('en-IN')}`);
  }
  if (d.splitFreeApprovedBy?.trim()) bits.push(`By ${d.splitFreeApprovedBy.trim()}`);
  if (d.splitFreeReason?.trim()) bits.push(d.splitFreeReason.trim());
  return bits.length ? bits.join(' · ') : null;
}

function getOfflineRupees(d: AdminDonation): number {
  if (d.splitCashRupees != null && d.splitCashRupees > 0) return d.splitCashRupees;
  if (d.paymentMethod === 'CASH') return d.amount / 100;
  return 0;
}

function getOnlineRupees(d: AdminDonation): number {
  if (d.splitOnlineRupees != null && d.splitOnlineRupees > 0) return d.splitOnlineRupees;
  if (d.paymentMethod === 'ONLINE') return d.amount / 100;
  return 0;
}

function splitBadges(d: AdminDonation): Array<{ kind: 'ONLINE' | 'CASH' | 'FREE'; rupees: number }> {
  const online = getOnlineRupees(d);
  const cash = getOfflineRupees(d);
  const free = d.splitFreeRupees != null && d.splitFreeRupees > 0 ? d.splitFreeRupees : 0;
  const out: Array<{ kind: 'ONLINE' | 'CASH' | 'FREE'; rupees: number }> = [];
  if (online > 0) out.push({ kind: 'ONLINE', rupees: online });
  if (cash > 0) out.push({ kind: 'CASH', rupees: cash });
  if (free > 0) out.push({ kind: 'FREE', rupees: free });
  return out;
}

function calculateTotalAmount(onlineRupees: number, offlineRupees: number, fallbackPaisa: number): number {
  const total = onlineRupees + offlineRupees;
  if (total > 0) return total;
  return fallbackPaisa / 100;
}

function getDonorDisplayName(d: AdminDonation): string {
  if (d.isAnonymous === true) return 'Anonymous';
  const raw = d.donorName?.trim();
  if (raw && raw.toLowerCase() !== 'anonymous') return raw;
  const userName = d.user?.name?.trim();
  if (userName) return userName;
  const profileName = d.profile?.fullName?.trim();
  if (profileName) return profileName;
  return 'Anonymous';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── Badge Components ─────────────────────────────────────

function StatusBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { label: string; className: string }> = {
    COMPLETED: { label: 'Completed', className: 'bg-green-100 text-green-700 border-green-200' },
    PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200' },
    REFUNDED: { label: 'Refunded', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  };
  const { label, className } = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}

function TypeBadge({ type }: { type: DonationType }) {
  const map: Record<DonationType, { label: string; className: string }> = {
    REGISTRATION: { label: 'Registration', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    GENERAL: { label: 'General', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  };
  const { label, className } = map[type] ?? { label: type, className: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {label}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}

function SummaryCard({ icon, label, value, sub, accent }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E8D5C4] p-2.5 md:p-3 xl:p-5 shadow-sm flex items-start md:gap-4 gap-2">
      <div className={`flex-shrink-0 w-8 md:w-11 h-8 md:h-11 rounded-xl flex items-center justify-center ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-temple-brown-light font-medium uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-xl font-bold text-temple-brown leading-tight">{value}</p>
        {sub && <p className="text-xs text-temple-brown-light mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Skeleton Row ──────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-[#F0E4D8]">
          {Array.from({ length: 8 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-[#F0E4D8] rounded animate-pulse" style={{ width: `${60 + (j * 13) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function AdminDonationsPage() {
  const router = useRouter();

  // ── Filter state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);

  // ── Data state
  const [donations, setDonations] = useState<AdminDonation[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [report, setReport] = useState<DonationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);

  // ── Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/auth?type=ADMIN'); return; }
    const user = getUser();
    if (user?.role !== 'ADMIN') { router.push('/auth?type=ADMIN'); }
  }, [router]);

  // Debounce search input
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [typeFilter, statusFilter]);

  // Fetch donations list
  const fetchDonations = useCallback(async () => {
    setLoading(true);
    try {
      const parts: string[] = [`page=${page}`, `limit=${PAGE_LIMIT}`];
      if (typeFilter !== 'ALL') parts.push(`type=${typeFilter}`);
      if (statusFilter !== 'ALL') parts.push(`status=${statusFilter}`);
      if (debouncedSearch.trim()) parts.push(`search=${encodeURIComponent(debouncedSearch.trim())}`);

      const result = await adminApi.listDonations(parts.join('&')) as DonationsListResponse;
      setDonations(result.data);
      setPagination({ total: result.total, page: result.page, totalPages: result.totalPages });
      if (result.summary) {
        setReport((prev) => ({
          totalCompleted: prev?.totalCompleted ?? 0,
          registrationCompleted: prev?.registrationCompleted ?? 0,
          generalCompleted: prev?.generalCompleted ?? 0,
          pendingCount: prev?.pendingCount ?? 0,
          failedCount: prev?.failedCount ?? 0,
          onlineRupees: toNumber(result.summary?.onlineRupees),
          offlineRupees: toNumber(result.summary?.offlineRupees),
          combinedRupees: toNumber(result.summary?.combinedRupees),
        }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load donations';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter, debouncedSearch]);

  // Fetch summary report
  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const data = await adminApi.donationReport('all') as DonationReportApiResponse;
      setReport(normalizeDonationReport(data));
    } catch {
      // Non-critical — summary cards degrade gracefully
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => { fetchDonations(); }, [fetchDonations]);
  useEffect(() => { fetchReport(); }, [fetchReport]);

  // ── Derived display helpers
  const showingFrom = donations.length === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const showingTo = (page - 1) * PAGE_LIMIT + donations.length;

  const pendingFailedCount = report ? report.pendingCount + report.failedCount : null;

  return (
    <div className="min-h-screen bg-cream">

      {/* ── Page Header ── */}
      <div className="bg-gradient-to-r from-maroon to-maroon-dark rounded-xl text-white px-6 py-5">
        <div>
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white mb-3 transition-colors"
          >
            <ArrowLeft size={15} /> Back to Admin
          </button>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                <ReceiptIndianRupee size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">Donations &amp; Payments</h1>
                <p className="text-xs text-white/60 font-hindi">दान एवं भुगतान प्रबंधन</p>
              </div>
            </div>
            <button
              onClick={() => { fetchDonations(); fetchReport(); }}
              className="flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="py-6 space-y-6">

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 md:gap-4 gap-2">
          <SummaryCard
            icon={<CreditCard size={20} className="text-blue-700" />}
            label="Online Payments"
            value={reportLoading ? '—' : `₹${formatRupeesValue(report?.onlineRupees ?? 0)}`}
            sub="Collected online"
            accent="bg-blue-100"
          />
          <SummaryCard
            icon={<Wallet size={20} className="text-emerald-700" />}
            label="Offline Payments"
            value={reportLoading ? '—' : `₹${formatRupeesValue(report?.offlineRupees ?? 0)}`}
            sub="Collected offline"
            accent="bg-emerald-100"
          />
          {/* <SummaryCard
            icon={<IndianRupee size={20} className="text-green-700" />}
            label="Total Completed"
            value={reportLoading ? '—' : `₹${formatRupeesValue(report?.totalCompleted ?? 0)}`}
            sub="All successful payments"
            accent="bg-green-100"
          /> */}
          {/* <SummaryCard
            icon={<CreditCard size={20} className="text-blue-700" />}
            label="Registration Fees"
            value={reportLoading ? '—' : `₹${formatRupeesValue(report?.registrationCompleted ?? 0)}`}
            sub="Completed registrations"
            accent="bg-blue-100"
          /> */}
          <SummaryCard
            icon={<Wallet size={20} className="text-amber-700" />}
            label="General Donations"
            value={reportLoading ? '—' : `₹${formatRupeesValue(report?.generalCompleted ?? 0)}`}
            sub="Completed donations"
            accent="bg-amber-100"
          />
          <SummaryCard
            icon={<CircleAlert size={20} className="text-red-700" />}
            label="Pending / Failed"
            value={reportLoading ? '—' : String(pendingFailedCount ?? 0)}
            sub={report ? `${report.pendingCount} pending, ${report.failedCount} failed` : undefined}
            accent="bg-red-100"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard
            icon={<IndianRupee size={20} className="text-purple-700" />}
            label="Grand Total"
            value={reportLoading ? '—' : `₹${formatRupeesValue(report?.combinedRupees ?? 0)}`}
            sub="Combined collection"
            accent="bg-purple-100"
          />
        </div>

        {/* ── Filters Row ── */}
        <div className="bg-white rounded-xl border border-[#E8D5C4] shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">

            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-temple-brown-light pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search donor name, mobile, payment ID..."
                className="input-field pl-9 w-full"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-temple-brown-light hover:text-temple-brown"
                  aria-label="Clear search"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Divider on larger screens */}
            <div className="hidden sm:flex items-center gap-2 text-temple-brown-light shrink-0">
              <SlidersHorizontal size={15} />
              <span className="text-xs font-medium">Filter</span>
            </div>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="input-field sm:w-44"
              aria-label="Filter by type"
            >
              <option value="ALL">All Types</option>
              <option value="REGISTRATION">Registration</option>
              <option value="GENERAL">General</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="input-field sm:w-44"
              aria-label="Filter by status"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
        </div>

        {/* ── Data Table ── */}
        <div className="bg-white rounded-xl border border-[#E8D5C4] shadow-sm overflow-hidden">

          {/* Table meta row */}
          <div className="px-4 py-3 border-b border-[#F0E4D8] flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-temple-brown-light">
              {loading
                ? 'Loading...'
                : pagination.total === 0
                  ? 'No donations found'
                  : `Showing ${showingFrom}–${showingTo} of ${pagination.total.toLocaleString('en-IN')} donations`}
            </p>
            {(typeFilter !== 'ALL' || statusFilter !== 'ALL' || debouncedSearch) && (
              <button
                onClick={() => { setSearch(''); setTypeFilter('ALL'); setStatusFilter('ALL'); }}
                className="text-xs text-maroon hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr className="bg-[#FDF6EE] border-b border-[#E8D5C4]">
                  <th className="px-4 py-3 text-left font-semibold text-temple-brown-light text-xs uppercase tracking-wide">
                    <span className="flex items-center gap-1.5"><CalendarDays size={13} /> Date</span>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-temple-brown-light text-xs uppercase tracking-wide">
                    <span className="flex items-center gap-1.5"><User size={13} /> Donor</span>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-temple-brown-light text-xs uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-temple-brown-light text-xs uppercase tracking-wide">
                    <span className="flex items-center gap-1.5"><IndianRupee size={13} /> Amount & Offline Split</span>
                  </th>
                  {/* <th className="px-4 py-3 text-left font-semibold text-temple-brown-light text-xs uppercase tracking-wide max-w-[220px]">
                    Offline split
                  </th> */}
                  <th className="px-4 py-3 text-left font-semibold text-temple-brown-light text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-temple-brown-light text-xs uppercase tracking-wide">
                    <span className="flex items-center gap-1.5"><CreditCard size={13} /> Payment ID</span>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-temple-brown-light text-xs uppercase tracking-wide">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E4D8]">
                {loading ? (
                  <SkeletonRows />
                ) : donations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <ReceiptIndianRupee size={36} className="text-[#E8D5C4] mx-auto mb-3" />
                      <p className="text-sm font-medium text-temple-brown">No donations found</p>
                      <p className="text-xs text-temple-brown-light mt-1">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                ) : (
                  donations.map((d) => {
                    const splitLabel = formatOfflineSplit(d);
                    console.log(splitLabel, "splitLabel --- **");
                    const offlineRupees = getOfflineRupees(d);
                    const onlineRupees = getOnlineRupees(d);
                    const totalRupees = calculateTotalAmount(onlineRupees, offlineRupees, d.amount);
                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-[#FFFAF5] transition-colors"
                      >
                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-temple-brown font-medium">{formatDate(d.createdAt)}</p>
                          <p className="text-[11px] text-temple-brown-light mt-0.5">{formatTime(d.createdAt)}</p>
                        </td>

                        {/* Donor */}
                        <td className="px-4 py-3">
                          <p className="text-temple-brown font-medium truncate max-w-[160px]">
                            {getDonorDisplayName(d)}
                          </p>
                          {d.donorMobile && (
                            <p className="text-[11px] text-temple-brown-light mt-0.5">{d.donorMobile}</p>
                          )}
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <TypeBadge type={d.type} />
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <p className="font-extrabold text-temple-brown text-lg leading-none">
                              ₹{formatRupeesValue(totalRupees)}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {splitBadges(d).map((b) => {
                                const cls =
                                  b.kind === 'ONLINE'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : b.kind === 'CASH'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200';
                                const Icon =
                                  b.kind === 'ONLINE' ? CreditCard : b.kind === 'CASH' ? Wallet : CircleAlert;
                                const label =
                                  b.kind === 'ONLINE' ? 'Online' : b.kind === 'CASH' ? 'Cash' : 'Waived';
                                return (
                                  <span
                                    key={b.kind}
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold ${cls}`}
                                  >
                                    <Icon size={12} />
                                    {label} ₹{formatRupeesValue(b.rupees)}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </td>

                        {/* Offline split (structured columns from API) */}
                        {/* <td className="px-4 py-3 max-w-[220px]">
                          {splitLabel ? (
                            <p className="text-xs text-temple-brown leading-snug break-words" title={splitLabel}>
                              {splitLabel}
                            </p>
                          ) : (
                            <span className="text-temple-brown-light text-xs italic">—</span>
                          )}
                        </td> */}
                        {/* <td className="px-4 py-3 max-w-[220px]">
                          {splitLabel ? (
                            <div className="flex flex-wrap gap-2">
                              {splitLabel.includes("Cash") && (
                                <span className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-md">
                                  💵 Cash ₹{splitLabel.match(/Cash ₹([\d,]+)/)?.[1]}
                                </span>
                              )}

                              {splitLabel.includes("Online") && (
                                <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-md">
                                  💳 Online ₹{splitLabel.match(/Online ₹([\d,]+)/)?.[1]}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-temple-brown-light text-xs italic">—</span>
                          )}
                        </td> */}

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={d.paymentStatus} />
                        </td>

                        {/* Payment ID */}
                        <td className="px-4 py-3">
                          {d.gatewayPaymentId ? (
                            <span
                              className="font-mono text-xs text-temple-brown-light bg-[#F7EFE6] px-2 py-0.5 rounded select-all cursor-text"
                              title={d.gatewayPaymentId}
                            >
                              {d.gatewayPaymentId.length > 20
                                ? `${d.gatewayPaymentId.slice(0, 10)}…${d.gatewayPaymentId.slice(-8)}`
                                : d.gatewayPaymentId}
                            </span>
                          ) : (
                            <span className="text-temple-brown-light text-xs italic">—</span>
                          )}
                        </td>

                        {/* Profile */}
                        <td className="px-4 py-3">
                          {d.profile ? (
                            <div>
                              <p className="text-temple-brown text-xs font-medium truncate max-w-[140px]">
                                {d.profile.fullName}
                              </p>
                              <p className="text-[11px] text-temple-brown-light font-mono mt-0.5">
                                #{d.profile.registrationNumber}
                              </p>
                            </div>
                          ) : (
                            <span className="text-temple-brown-light text-xs italic">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {!loading && pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-[#F0E4D8] flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-temple-brown-light">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex items-center gap-1">
                {/* First */}
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#E8D5C4] text-temple-brown-light hover:bg-[#FDF6EE] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="First page"
                >
                  «
                </button>

                {/* Prev */}
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E8D5C4] text-temple-brown-light hover:bg-[#FDF6EE] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={13} /> Prev
                </button>

                {/* Page numbers */}
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (pagination.totalPages <= 7) return true;
                    if (p === 1 || p === pagination.totalPages) return true;
                    if (Math.abs(p - page) <= 2) return true;
                    return false;
                  })
                  .reduce<Array<number | 'gap'>>((acc, p, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                      acc.push('gap');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === 'gap' ? (
                      <span key={`gap-${idx}`} className="px-1 text-temple-brown-light text-xs select-none">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item as number)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium border transition-colors ${page === item
                          ? 'bg-maroon border-maroon text-white'
                          : 'border-[#E8D5C4] text-temple-brown hover:bg-[#FDF6EE]'
                          }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                {/* Next */}
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E8D5C4] text-temple-brown-light hover:bg-[#FDF6EE] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight size={13} />
                </button>

                {/* Last */}
                <button
                  onClick={() => setPage(pagination.totalPages)}
                  disabled={page === pagination.totalPages}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#E8D5C4] text-temple-brown-light hover:bg-[#FDF6EE] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Last page"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
