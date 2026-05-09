'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  IndianRupee,
  Receipt,
  TrendingUp,
  Clock,
  XCircle,
  Eye,
  Printer,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import type { DonationType, PaginatedResponse } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'weekly' | 'monthly' | 'yearly';
type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

interface SalesSummary {
  period: string;
  since: string;
  completed: { count: number; amount: number };
  pending: { count: number; amount: number };
  failed: { count: number };
  refunded: { count: number; amount: number };
  byType: {
    registration: { count: number; amount: number };
    general: { count: number; amount: number };
  };
  allTime: { count: number; amount: number };
}

interface AdminDonation {
  id: string;
  invoiceNumber: string | null;
  type: DonationType;
  amount: number; // paisa
  paymentStatus: PaymentStatus;
  donorName: string | null;
  donorMobile: string | null;
  gatewayPaymentId: string | null;
  createdAt: string;
  profile: {
    fullName: string;
    registrationNumber: string;
  } | null;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  type: DonationType;
  amount: number; // rupees
  currency: string;
  gateway: string;
  gatewayPaymentId: string;
  donor: { name: string; mobile: string; email: string | null };
  profile: { name: string; registrationNumber: string } | null;
  temple: { name: string; address: string; committee: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 15;

const PERIOD_LABELS: Record<Period, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRupeesFromPaisa(paisa: number): string {
  return (paisa / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtRupees(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── Badge Components ─────────────────────────────────────────────────────────

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

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  loading?: boolean;
}

function SummaryCard({ icon, label, value, sub, accent, loading }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E8D5C4] p-4 shadow-sm flex items-start gap-3">
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-temple-brown-light font-medium uppercase tracking-wide mb-0.5 leading-tight">
          {label}
        </p>
        {loading ? (
          <div className="h-6 bg-[#F0E4D8] rounded animate-pulse w-24 mt-1" />
        ) : (
          <p className="text-lg font-bold text-temple-brown leading-tight">{value}</p>
        )}
        {sub && !loading && (
          <p className="text-xs text-temple-brown-light mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton Table Rows ──────────────────────────────────────────────────────

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-[#F0E4D8]">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-4 bg-[#F0E4D8] rounded animate-pulse"
                style={{ width: `${50 + (j * 17 + i * 11) % 45}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Invoice Modal ────────────────────────────────────────────────────────────

interface InvoiceModalProps {
  donationId: string;
  onClose: () => void;
}

function InvoiceModal({ donationId, onClose }: InvoiceModalProps) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const data = await adminApi.getInvoice(donationId) as InvoiceData;
        if (!cancelled) setInvoice(data);
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load invoice';
          setError(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [donationId]);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Print-only styles injected into head via a style tag in JSX */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #invoice-print-root { display: block !important; }
          #invoice-print-root .no-print { display: none !important; }
          #invoice-print-root .print-card {
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            margin: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        role="dialog"
        aria-modal="true"
        aria-label="Invoice detail"
      >
        <div
          id="invoice-print-root"
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: '90vh', overflowY: 'auto' }}
        >
          {/* Modal header bar */}
          <div
            className="no-print flex items-center justify-between px-5 py-4 border-b border-[#E8D5C4]"
            style={{ backgroundColor: '#8B1A1A' }}
          >
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-[#D4A843]" />
              <span className="font-semibold text-white text-sm">Invoice Detail</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs font-medium bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors"
                aria-label="Print invoice"
              >
                <Printer size={13} /> Print
              </button>
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/15"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-[3px] border-[#E8D5C4] border-t-[#8B1A1A] rounded-full animate-spin" />
              <p className="text-sm text-temple-brown-light">Loading invoice...</p>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
              <XCircle size={36} className="text-red-400" />
              <p className="text-sm font-medium text-temple-brown">Failed to load invoice</p>
              <p className="text-xs text-temple-brown-light">{error}</p>
            </div>
          )}

          {/* Invoice card content */}
          {!loading && !error && invoice && (
            <div className="print-card p-6">

              {/* Temple header */}
              <div className="text-center border-b border-[#E8D5C4] pb-4 mb-4">
                <p
                  className="font-hindi text-lg font-bold leading-snug"
                  style={{ color: '#8B1A1A' }}
                >
                  {invoice.temple.name}
                </p>
                <p className="text-xs text-temple-brown-light mt-1">{invoice.temple.address}</p>
                <p className="text-xs text-temple-brown-light mt-0.5">{invoice.temple.committee}</p>
                <div
                  className="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: '#FFF8F0', color: '#8B1A1A', border: '1px solid #E8D5C4' }}
                >
                  Payment Receipt
                </div>
              </div>

              {/* Invoice meta */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs text-temple-brown-light uppercase tracking-wide font-medium">Invoice No.</p>
                  <p className="text-sm font-bold text-temple-brown font-mono mt-0.5">
                    {invoice.invoiceNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-temple-brown-light uppercase tracking-wide font-medium">Date</p>
                  <p className="text-sm font-medium text-temple-brown mt-0.5">{fmtDateTime(invoice.date)}</p>
                </div>
              </div>

              {/* Donor details */}
              <div
                className="rounded-xl p-4 mb-4"
                style={{ backgroundColor: '#FFF8F0', border: '1px solid #E8D5C4' }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: '#8B1A1A' }}
                >
                  Donor Details
                </p>
                <div className="space-y-1.5">
                  <Row label="Name" value={invoice.donor.name} />
                  <Row label="Mobile" value={invoice.donor.mobile} />
                  {invoice.donor.email && (
                    <Row label="Email" value={invoice.donor.email} />
                  )}
                </div>
              </div>

              {/* Profile details (registration only) */}
              {invoice.profile && (
                <div
                  className="rounded-xl p-4 mb-4"
                  style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-blue-700">
                    Profile Details
                  </p>
                  <div className="space-y-1.5">
                    <Row label="Name" value={invoice.profile.name} />
                    <Row label="Reg. Number" value={`#${invoice.profile.registrationNumber}`} mono />
                  </div>
                </div>
              )}

              {/* Amount & payment */}
              <div
                className="rounded-xl p-4 mb-4"
                style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-green-700">
                  Payment Details
                </p>
                <div className="space-y-1.5">
                  <Row label="Type" value={invoice.type === 'REGISTRATION' ? 'Registration Fee' : 'General Donation'} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-temple-brown-light font-medium">Amount</span>
                    <span className="text-base font-bold text-green-700">
                      ₹{fmtRupees(invoice.amount)}
                    </span>
                  </div>
                  <Row label="Gateway" value={invoice.gateway.charAt(0).toUpperCase() + invoice.gateway.slice(1)} />
                  <Row label="Payment ID" value={invoice.gatewayPaymentId} mono />
                </div>
              </div>

              {/* Footer */}
              <p className="text-center text-[11px] text-temple-brown-light mt-4 pt-4 border-t border-[#E8D5C4]">
                This is a computer-generated receipt and does not require a physical signature.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Small helper for invoice key-value rows
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-temple-brown-light font-medium flex-shrink-0">{label}</span>
      <span className={`text-xs text-temple-brown text-right break-all ${mono ? 'font-mono' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSalesPage() {
  const router = useRouter();

  // Period selector
  const [period, setPeriod] = useState<Period>('monthly');

  // Summary state
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Table state
  const [donations, setDonations] = useState<AdminDonation[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [tableLoading, setTableLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Invoice modal state
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  // Ref to cancel in-flight requests
  const summaryAbort = useRef<AbortController | null>(null);

  // ── Fetch sales summary
  const fetchSummary = useCallback(async (p: Period) => {
    summaryAbort.current?.abort();
    summaryAbort.current = new AbortController();
    setSummaryLoading(true);
    try {
      const data = await adminApi.salesSummary(p) as SalesSummary;
      setSummary(data);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Failed to load sales summary';
      toast.error(msg);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // ── Fetch donations list
  const fetchDonations = useCallback(async (pg: number) => {
    setTableLoading(true);
    try {
      const params = `page=${pg}&limit=${PAGE_LIMIT}`;
      const result = await adminApi.listDonations(params) as PaginatedResponse<AdminDonation>;
      setDonations(result.data);
      setPagination({ total: result.total, page: result.page, totalPages: result.totalPages });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load transactions';
      toast.error(msg);
    } finally {
      setTableLoading(false);
    }
  }, []);

  // Re-fetch summary when period changes, reset to page 1
  useEffect(() => {
    fetchSummary(period);
  }, [period, fetchSummary]);

  // Re-fetch table when page changes
  useEffect(() => {
    fetchDonations(page);
  }, [page, fetchDonations]);

  // Derived display
  const showingFrom = donations.length === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const showingTo = (page - 1) * PAGE_LIMIT + donations.length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFF8F0' }}>

      {/* ── Page Header ── */}
      <div
        className="text-white px-6 py-5 rounded-xl"
        style={{ background: 'linear-gradient(to right, #8B1A1A, #5a0f0f)' }}
      >
        <div>
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 text-sm mb-3 transition-colors"
            style={{ color: 'rgba(255,255,255,0.65)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)')}
          >
            <ArrowLeft size={15} /> Back to Admin
          </button>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <IndianRupee size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">Sales &amp; Invoices</h1>
                <p className="text-xs font-hindi mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  बिक्री एवं चालान प्रबंधन
                </p>
              </div>
            </div>
            <button
              onClick={() => { fetchSummary(period); fetchDonations(page); }}
              className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.2)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.1)')}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className=" py-6 space-y-6">

        {/* ── Period Selector ── */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-[#E8D5C4] shadow-sm p-1 w-fit">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setPage(1); }}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={
                period === p
                  ? { backgroundColor: '#8B1A1A', color: '#ffffff' }
                  : { color: '#6B3A1F' }
              }
              onMouseEnter={(e) => {
                if (period !== p) (e.currentTarget as HTMLElement).style.backgroundColor = '#FFF0E0';
              }}
              onMouseLeave={(e) => {
                if (period !== p) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* ── Period context label ── */}
        {summary && !summaryLoading && (
          <p className="text-xs text-temple-brown-light -mt-3">
            Showing data since{' '}
            <span className="font-medium text-temple-brown">{fmtDate(summary.since)}</span>
          </p>
        )}

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 md:gap-3 gap-2 ">

          {/* Total Sales */}
          <SummaryCard
            icon={<TrendingUp size={18} className="text-green-700" />}
            label="Total Sales"
            value={summary ? `₹${fmtRupees(summary.completed.amount)}` : '—'}
            sub={summary ? `${summary.completed.count} transactions` : undefined}
            accent="bg-green-100"
            loading={summaryLoading}
          />

          {/* Registration Fees */}
          <SummaryCard
            icon={<Receipt size={18} className="text-blue-700" />}
            label="Registration Fees"
            value={summary ? `₹${fmtRupees(summary.byType.registration.amount)}` : '—'}
            sub={summary ? `${summary.byType.registration.count} payments` : undefined}
            accent="bg-blue-100"
            loading={summaryLoading}
          />

          {/* General Donations */}
          <SummaryCard
            icon={<IndianRupee size={18} className="text-purple-700" />}
            label="General Donations"
            value={summary ? `₹${fmtRupees(summary.byType.general.amount)}` : '—'}
            sub={summary ? `${summary.byType.general.count} donations` : undefined}
            accent="bg-purple-100"
            loading={summaryLoading}
          />

          {/* Pending */}
          <SummaryCard
            icon={<Clock size={18} className="text-yellow-700" />}
            label="Pending"
            value={summary ? `₹${fmtRupees(summary.pending.amount)}` : '—'}
            sub={summary ? `${summary.pending.count} awaiting` : undefined}
            accent="bg-yellow-100"
            loading={summaryLoading}
          />

          {/* Failed / Refunded */}
          <SummaryCard
            icon={<XCircle size={18} className="text-red-700" />}
            label="Failed / Refunded"
            value={summary ? String(summary.failed.count + summary.refunded.count) : '—'}
            sub={
              summary
                ? `${summary.failed.count} failed, ${summary.refunded.count} refunded`
                : undefined
            }
            accent="bg-red-100"
            loading={summaryLoading}
          />
        </div>

        {/* ── All-Time Stats Bar ── */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border"
          style={{ backgroundColor: '#FFF8F0', borderColor: '#E8D5C4' }}
        >
          <IndianRupee size={14} style={{ color: '#D4A843', flexShrink: 0 }} />
          {summaryLoading ? (
            <div className="h-4 bg-[#F0E4D8] rounded animate-pulse w-48" />
          ) : summary ? (
            <span style={{ color: '#6B3A1F' }}>
              All-time total:{' '}
              <span className="font-bold" style={{ color: '#3D1F0B' }}>
                ₹{fmtRupees(summary.allTime.amount)}
              </span>{' '}
              from{' '}
              <span className="font-bold" style={{ color: '#3D1F0B' }}>
                {summary.allTime.count.toLocaleString('en-IN')}
              </span>{' '}
              transactions
            </span>
          ) : (
            <span style={{ color: '#6B3A1F' }}>All-time data unavailable</span>
          )}
        </div>

        {/* ── Transactions Table ── */}
        <div className="bg-white rounded-xl border border-[#E8D5C4] shadow-sm overflow-hidden">

          {/* Table header bar */}
          <div className="px-4 py-3 border-b border-[#F0E4D8] flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-temple-brown-light">
              {tableLoading
                ? 'Loading transactions...'
                : pagination.total === 0
                  ? 'No transactions found'
                  : `Showing ${showingFrom}–${showingTo} of ${pagination.total.toLocaleString('en-IN')} transactions`}
            </p>
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: '#22c55e' }}
              />
              <span className="text-xs text-temple-brown-light">All statuses</span>
            </div>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-[#E8D5C4]" style={{ backgroundColor: '#FDF6EE' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-temple-brown-light uppercase tracking-wide">
                    Invoice #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-temple-brown-light uppercase tracking-wide">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-temple-brown-light uppercase tracking-wide">
                    Donor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-temple-brown-light uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-temple-brown-light uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-temple-brown-light uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-temple-brown-light uppercase tracking-wide">
                    Payment ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-temple-brown-light uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E4D8]">
                {tableLoading ? (
                  <SkeletonRows cols={8} />
                ) : donations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <Receipt size={36} className="text-[#E8D5C4] mx-auto mb-3" />
                      <p className="text-sm font-medium text-temple-brown">No transactions found</p>
                      <p className="text-xs text-temple-brown-light mt-1">Transactions will appear here once payments are made</p>
                    </td>
                  </tr>
                ) : (
                  donations.map((d) => (
                    <tr key={d.id} className="hover:bg-[#FFFAF5] transition-colors">

                      {/* Invoice # */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {d.invoiceNumber ? (
                          <span className="font-mono text-xs font-semibold text-temple-brown bg-[#F7EFE6] px-2 py-0.5 rounded">
                            {d.invoiceNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-temple-brown-light italic">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-temple-brown font-medium text-xs">{fmtDate(d.createdAt)}</p>
                        <p className="text-[11px] text-temple-brown-light mt-0.5">{fmtTime(d.createdAt)}</p>
                      </td>

                      {/* Donor */}
                      <td className="px-4 py-3">
                        <p className="text-temple-brown font-medium text-xs truncate max-w-[140px]">
                          {d.donorName ?? <span className="italic text-temple-brown-light">Anonymous</span>}
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
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-semibold text-temple-brown text-sm">
                          ₹{fmtRupeesFromPaisa(d.amount)}
                        </span>
                      </td>

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
                            {d.gatewayPaymentId.length > 18
                              ? `${d.gatewayPaymentId.slice(0, 10)}…${d.gatewayPaymentId.slice(-6)}`
                              : d.gatewayPaymentId}
                          </span>
                        ) : (
                          <span className="text-xs text-temple-brown-light italic">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {d.paymentStatus === 'COMPLETED' ? (
                          <button
                            onClick={() => setInvoiceId(d.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all duration-200"
                            style={{
                              color: '#8B1A1A',
                              borderColor: '#E8D5C4',
                              backgroundColor: '#FFF8F0',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundColor = '#8B1A1A';
                              (e.currentTarget as HTMLElement).style.color = '#ffffff';
                              (e.currentTarget as HTMLElement).style.borderColor = '#8B1A1A';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundColor = '#FFF8F0';
                              (e.currentTarget as HTMLElement).style.color = '#8B1A1A';
                              (e.currentTarget as HTMLElement).style.borderColor = '#E8D5C4';
                            }}
                            aria-label={`View invoice for transaction ${d.invoiceNumber ?? d.id}`}
                          >
                            <Eye size={13} /> View Invoice
                          </button>
                        ) : (
                          <span className="text-xs text-temple-brown-light italic">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {!tableLoading && pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-[#F0E4D8] flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-temple-brown-light">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex items-center gap-1">
                {/* Previous */}
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E8D5C4] text-temple-brown-light hover:bg-[#FDF6EE] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={13} /> Prev
                </button>

                {/* Page number pills */}
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((pg) => {
                    if (pagination.totalPages <= 7) return true;
                    if (pg === 1 || pg === pagination.totalPages) return true;
                    if (Math.abs(pg - page) <= 2) return true;
                    return false;
                  })
                  .reduce<Array<number | 'gap'>>((acc, pg, idx, arr) => {
                    if (
                      idx > 0 &&
                      typeof arr[idx - 1] === 'number' &&
                      (pg as number) - (arr[idx - 1] as number) > 1
                    ) {
                      acc.push('gap');
                    }
                    acc.push(pg);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === 'gap' ? (
                      <span key={`gap-${idx}`} className="px-1 text-temple-brown-light text-xs select-none">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item as number)}
                        className="w-8 h-8 rounded-lg text-xs font-medium border transition-colors"
                        style={
                          page === item
                            ? { backgroundColor: '#8B1A1A', borderColor: '#8B1A1A', color: '#ffffff' }
                            : { borderColor: '#E8D5C4', color: '#3D1F0B' }
                        }
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
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Invoice Modal ── */}
      {invoiceId && (
        <InvoiceModal
          donationId={invoiceId}
          onClose={() => setInvoiceId(null)}
        />
      )}
    </div>
  );
}
