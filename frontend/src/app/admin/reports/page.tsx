'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Users,
  IndianRupee,
  TrendingUp,
  UserCheck,
  UserX,
  Clock,
  RefreshCw,
  Activity,
  Download,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Period = 'weekly' | 'monthly' | 'yearly';

interface GenderStat {
  gender: string;
  _count: number;
}

interface RegistrationReport {
  total: number;
  active: number;
  settled: number;
  pending: number;
  newThisPeriod: number;
  genderStats: GenderStat[];
}

interface DonationReport {
  registration: { count: number; totalAmount: number };
  general: { count: number; totalAmount: number };
  grandTotal: number;
}

interface ActivityEntry {
  id: string;
  action: string;
  createdAt: string;
  user: { name: string | null; mobile: string };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function rupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PERIOD_DAYS: Record<Period, number> = {
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

const PERIOD_LABELS: Record<Period, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

// ─── Sub-components ────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

function StatCard({ icon, label, value, sub, accent = '#8B1A1A' }: StatCardProps) {
  return (
    <div
      className="rounded-xl border p-4 flex items-start gap-3"
      style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${accent}14` }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div>
        <p className="text-xl font-bold leading-tight" style={{ color: accent }}>
          {value}
        </p>
        <p className="text-xs font-medium mt-0.5" style={{ color: '#3D1F0B' }}>
          {label}
        </p>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: '#6B3A1F' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
}

function SectionHeader({ icon, title }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span style={{ color: '#8B1A1A' }}>{icon}</span>
      <h2 className="font-bold text-base" style={{ color: '#3D1F0B' }}>
        {title}
      </h2>
    </div>
  );
}

// ─── CSV Download ───────────────────────────────────────────────────────────────

function downloadReportCsv(
  regReport: RegistrationReport,
  donReport: DonationReport,
  period: Period,
) {
  const lines = [
    `RishteNate - ${PERIOD_LABELS[period]} Report`,
    '',
    'Registration Stats',
    `Total,${regReport.total}`,
    `Active,${regReport.active}`,
    `Settled,${regReport.settled}`,
    `Pending,${regReport.pending}`,
    `New This Period,${regReport.newThisPeriod}`,
    '',
    'Donation Stats',
    `Registration Fees,${donReport.registration.count},₹${donReport.registration.totalAmount}`,
    `General Donations,${donReport.general.count},₹${donReport.general.totalAmount}`,
    `Grand Total,,₹${donReport.grandTotal}`,
  ];
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rishtenate-${period}-report.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [regReport, setRegReport] = useState<RegistrationReport | null>(null);
  const [donReport, setDonReport] = useState<DonationReport | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const days = PERIOD_DAYS[p];
      const [reg, don, act] = await Promise.all([
        adminApi.registrationReport(p) as Promise<RegistrationReport>,
        adminApi.donationReport(p) as Promise<DonationReport>,
        adminApi.teamActivity(days) as Promise<ActivityEntry[]>,
      ]);
      setRegReport(reg);
      setDonReport(don);
      setActivity(act);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll(period);
  }, [period, loadAll]);

  // ── Gender breakdown helpers ─────────────────────────────────────────────

  function genderCount(gender: string): number {
    if (!regReport) return 0;
    return (
      regReport.genderStats.find(
        (g) => g.gender.toLowerCase() === gender.toLowerCase()
      )?._count ?? 0
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#8B1A1A' }}>
            Reports
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B3A1F' }}>
            Registration, donation, and team activity statistics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl border"
            style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
          >
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
                style={
                  period === p
                    ? { backgroundColor: '#8B1A1A', color: '#fff' }
                    : { color: '#6B3A1F' }
                }
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Download CSV button */}
          <button
            onClick={() => {
              if (regReport && donReport) downloadReportCsv(regReport, donReport, period);
            }}
            disabled={!regReport || !donReport || loading}
            title="Download CSV report"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#fff', borderColor: '#E8D5C4', color: '#8B1A1A' }}
            onMouseEnter={(e) => {
              if (regReport && donReport && !loading)
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,26,26,0.08)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#fff';
            }}
          >
            <Download size={15} />
            Download CSV
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: '#6B3A1F' }}>
          <RefreshCw
            size={28}
            className="animate-spin"
            style={{ color: '#8B1A1A' }}
          />
          <p className="text-sm">Loading {PERIOD_LABELS[period].toLowerCase()} report…</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          className="rounded-xl border p-6 text-center"
          style={{
            backgroundColor: 'rgba(239,68,68,0.05)',
            borderColor: 'rgba(239,68,68,0.2)',
          }}
        >
          <p className="font-semibold text-red-600 mb-1">Failed to load data</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={() => loadAll(period)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ backgroundColor: '#8B1A1A', color: '#fff' }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* ── Registration Stats ───────────────────────────────────────────── */}
      {!loading && !error && regReport && (
        <section
          className="rounded-xl border p-5 shadow-sm"
          style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
        >
          <SectionHeader
            icon={<Users size={18} />}
            title="Registration Statistics"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              icon={<Users size={16} />}
              label="Total Profiles"
              value={regReport.total}
              accent="#8B1A1A"
            />
            <StatCard
              icon={<UserCheck size={16} />}
              label="Active"
              value={regReport.active}
              accent="#16a34a"
            />
            <StatCard
              icon={<TrendingUp size={16} />}
              label="Settled"
              value={regReport.settled}
              accent="#D4A843"
            />
            <StatCard
              icon={<UserX size={16} />}
              label="Pending"
              value={regReport.pending}
              accent="#6b7280"
            />
            <StatCard
              icon={<BarChart3 size={16} />}
              label={`New this ${PERIOD_LABELS[period].toLowerCase()}`}
              value={regReport.newThisPeriod}
              accent="#7c3aed"
            />
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: '#E8D5C4' }}
            >
              <p className="text-xs font-medium mb-2" style={{ color: '#3D1F0B' }}>
                Gender Split
              </p>
              <div className="space-y-1.5">
                {[
                  { label: 'Bride', key: 'BRIDE', color: '#db2777' },
                  { label: 'Groom', key: 'GROOM', color: '#2563eb' },
                ].map(({ label, key, color }) => {
                  const count = genderCount(key);
                  const total = regReport.total || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-0.5" style={{ color: '#6B3A1F' }}>
                        <span>{label}</span>
                        <span style={{ color }}>
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: '#E8D5C4' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Donation Stats ───────────────────────────────────────────────── */}
      {!loading && !error && donReport && (
        <section
          className="rounded-xl border p-5 shadow-sm"
          style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
        >
          <SectionHeader
            icon={<IndianRupee size={18} />}
            title="Donation Statistics"
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Registration donations */}
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: '#E8D5C4', backgroundColor: '#FFFAF5' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#8B1A1A' }}>
                Registration Donations
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#6B3A1F' }}>Transactions</span>
                  <span className="font-bold" style={{ color: '#3D1F0B' }}>
                    {donReport.registration.count}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#6B3A1F' }}>Total Amount</span>
                  <span className="font-bold" style={{ color: '#8B1A1A' }}>
                    {rupees(donReport.registration.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* General donations */}
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: '#E8D5C4', backgroundColor: '#FFFAF5' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#D4A843' }}>
                General Donations
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#6B3A1F' }}>Transactions</span>
                  <span className="font-bold" style={{ color: '#3D1F0B' }}>
                    {donReport.general.count}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#6B3A1F' }}>Total Amount</span>
                  <span className="font-bold" style={{ color: '#D4A843' }}>
                    {rupees(donReport.general.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Grand total */}
            <div
              className="rounded-xl border p-4 flex flex-col justify-center items-center text-center sm:col-span-2 lg:col-span-1"
              style={{ backgroundColor: '#8B1A1A', borderColor: '#8B1A1A' }}
            >
              <IndianRupee size={22} className="text-gold mb-1" />
              <p className="text-2xl font-bold text-white">
                {rupees(donReport.grandTotal)}
              </p>
              <p className="text-xs text-white/70 mt-0.5">Grand Total</p>
            </div>
          </div>
        </section>
      )}

      {/* ── Team Activity ─────────────────────────────────────────────────── */}
      {!loading && !error && (
        <section
          className="rounded-xl border shadow-sm overflow-hidden"
          style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
        >
          {/* Section header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: '#E8D5C4', backgroundColor: '#FFFAF5' }}
          >
            <div className="flex items-center gap-2">
              <Activity size={18} style={{ color: '#8B1A1A' }} />
              <h2 className="font-bold text-base" style={{ color: '#3D1F0B' }}>
                Team Activity Log
              </h2>
            </div>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(139,26,26,0.08)', color: '#8B1A1A' }}
            >
              Last {PERIOD_DAYS[period]} days
            </span>
          </div>

          {activity.length === 0 ? (
            <div className="py-12 text-center" style={{ color: '#6B3A1F' }}>
              <Activity size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No activity recorded in this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottomColor: '#E8D5C4', borderBottomWidth: 1 }}>
                    {['Date / Time', 'Member', 'Action'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: '#6B3A1F' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activity.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b last:border-0 hover:bg-[#FFFAF5] transition-colors"
                      style={{ borderColor: '#E8D5C4' }}
                    >
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1.5" style={{ color: '#6B3A1F' }}>
                          <Clock size={12} />
                          {formatTs(entry.createdAt)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium" style={{ color: '#3D1F0B' }}>
                          {entry.user.name ?? 'Unknown'}
                        </p>
                        <p className="text-xs" style={{ color: '#6B3A1F' }}>
                          {entry.user.mobile}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <ActionBadge action={entry.action} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Action badge (shared with activity page) ──────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; color: string }> = {
  LOGIN:        { bg: 'rgba(37,99,235,0.10)',   color: '#2563eb' },
  SEARCH:       { bg: 'rgba(107,114,128,0.10)', color: '#6b7280' },
  EXPORT:       { bg: 'rgba(22,163,74,0.10)',   color: '#16a34a' },
  EDIT_PROFILE: { bg: 'rgba(217,119,6,0.10)',   color: '#d97706' },
  MARK_SETTLED: { bg: 'rgba(124,58,237,0.10)',  color: '#7c3aed' },
  PRINT:        { bg: 'rgba(79,70,229,0.10)',   color: '#4f46e5' },
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLES[action] ?? {
    bg: 'rgba(139,26,26,0.10)',
    color: '#8B1A1A',
  };
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {action.replace(/_/g, ' ')}
    </span>
  );
}
