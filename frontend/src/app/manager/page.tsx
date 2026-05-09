'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Download,
  Printer,
  Activity,
  Users,
  UserCheck,
  Clock,
  AlertCircle,
  Briefcase,
} from 'lucide-react';
import { teamApi, getUser } from '@/lib/api';
import { formatActivityDetails } from '@/lib/activity-format';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionType =
  | 'SEARCH'
  | 'EXPORT'
  | 'EDIT_PROFILE'
  | 'MARK_SETTLED'
  | 'MARK_UNSETTLED'
  | 'PRINT';

interface RecentActivity {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
}

interface DashboardData {
  profiles: {
    total: number;
    active: number;
    settled: number;
    pending: number;
  };
  myActions: number;
  recentActivities: RecentActivity[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMERALD = '#059669';
const EMERALD_DARK = '#047857';

// ─── Action badge config ──────────────────────────────────────────────────────

const ACTION_BADGE: Record<
  ActionType,
  { label: string; className: string }
> = {
  SEARCH:         { label: 'Search',         className: 'bg-gray-100 text-gray-700 border border-gray-200'     },
  EXPORT:         { label: 'Export',          className: 'bg-green-100 text-green-700 border border-green-200'  },
  EDIT_PROFILE:   { label: 'Edit Profile',    className: 'bg-amber-100 text-amber-700 border border-amber-200'  },
  MARK_SETTLED:   { label: 'Mark Settled',    className: 'bg-purple-100 text-purple-700 border border-purple-200' },
  MARK_UNSETTLED: { label: 'Mark Unsettled',  className: 'bg-pink-100 text-pink-700 border border-pink-200'     },
  PRINT:          { label: 'Print',           className: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_BADGE[action as ActionType] ?? {
    label: action.replace(/_/g, ' '),
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  iconBg: string;
}

function StatCard({ icon, value, label, iconBg }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div
        className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-emerald-900 leading-tight">
          {value.toLocaleString('en-IN')}
        </p>
        <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-50" />
        <div className="flex-1">
          <div className="h-7 bg-emerald-50 rounded w-16 mb-2" />
          <div className="h-4 bg-emerald-50 rounded w-28" />
        </div>
      </div>
    </div>
  );
}

function ActivityRowSkeleton() {
  return (
    <tr className="animate-pulse border-t border-emerald-50">
      <td className="px-5 py-3">
        <div className="h-4 bg-emerald-50 rounded w-28" />
      </td>
      <td className="px-5 py-3">
        <div className="h-5 bg-emerald-50 rounded-full w-20" />
      </td>
      <td className="px-5 py-3">
        <div className="h-4 bg-emerald-50 rounded w-40" />
      </td>
    </tr>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatCurrentDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Quick action card ────────────────────────────────────────────────────────

interface QuickActionCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  iconBg: string;
  iconColor: string;
}

function QuickActionCard({
  href,
  icon,
  title,
  description,
  iconBg,
  iconColor,
}: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-2xl border border-emerald-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-emerald-300 transition-all duration-200 cursor-pointer"
    >
      <div
        className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${iconBg} group-hover:scale-105 transition-transform duration-200`}
      >
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800 group-hover:text-emerald-700 transition-colors">
          {title}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{description}</p>
      </div>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ManagerDashboardPage() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const result = await teamApi.dashboard() as DashboardData;
      setData(result);
    } catch {
      // auth errors are handled by the api wrapper (redirects to /auth)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getUser();
    setUserName(user?.name ?? user?.mobile ?? 'Manager');
    loadDashboard();
  }, [loadDashboard]);

  const statCards: StatCardProps[] = data
    ? [
        {
          icon: <Users size={22} style={{ color: EMERALD }} />,
          value: data.profiles.total,
          label: 'Total Profiles',
          iconBg: 'bg-emerald-50',
        },
        {
          icon: <UserCheck size={22} className="text-green-700" />,
          value: data.profiles.active,
          label: 'Active',
          iconBg: 'bg-green-50',
        },
        {
          icon: <Activity size={22} className="text-purple-700" />,
          value: data.profiles.settled,
          label: 'Settled',
          iconBg: 'bg-purple-50',
        },
        {
          icon: <Clock size={22} className="text-amber-600" />,
          value: data.profiles.pending,
          label: 'Pending Payment',
          iconBg: 'bg-amber-50',
        },
      ]
    : [];

  const quickActions: QuickActionCardProps[] = [
    {
      href: '/manager/profiles',
      icon: <Search size={20} />,
      title: 'Search Profiles',
      description: 'Find profiles by name, mobile, reg. no.',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      href: '/manager/export',
      icon: <Download size={20} />,
      title: 'Unlimited Export',
      description: 'Download all profiles as CSV — no batch limit',
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      href: '/manager/print',
      icon: <Printer size={20} />,
      title: 'Print Forms',
      description: 'Print registration forms by date range',
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      href: '/manager/activity',
      icon: <Activity size={20} />,
      title: 'My Activity',
      description: 'View your full action history',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
  ];

  return (
    <div className="min-h-screen bg-emerald-50/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Welcome header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-emerald-900 tracking-tight">
              Welcome back,{' '}
              <span style={{ color: EMERALD }}>
                {loading && !userName ? '...' : userName}
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">{formatCurrentDate()}</p>
          </div>
          {!loading && data && (
            <div className="flex items-center gap-2 bg-white border border-emerald-100 rounded-xl px-4 py-2 shadow-sm self-start sm:self-auto">
              <Briefcase size={15} style={{ color: EMERALD }} />
              <span className="text-sm font-medium text-emerald-800">
                {data.myActions.toLocaleString('en-IN')} actions recorded
              </span>
            </div>
          )}
        </div>

        {/* ── Stat cards ── */}
        <section aria-label="Profile statistics">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
              : statCards.map((card, i) => <StatCard key={i} {...card} />)}
          </div>
        </section>

        {/* ── Quick actions ── */}
        <section aria-label="Quick actions">
          <h2 className="text-base font-semibold text-emerald-900 mb-3 flex items-center gap-2">
            <span
              className="w-1 h-5 rounded-full inline-block"
              style={{ backgroundColor: EMERALD }}
            />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <QuickActionCard key={action.href} {...action} />
            ))}
          </div>
        </section>

        {/* ── Manager privilege badge ── */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium"
          style={{
            backgroundColor: '#ECFDF5',
            borderColor: '#6EE7B7',
            color: EMERALD_DARK,
          }}
        >
          <Briefcase size={16} style={{ color: EMERALD }} />
          <span>
            Manager privileges active — unlimited CSV export, full profile access including
            inactive records.
          </span>
        </div>

        {/* ── Recent activity ── */}
        <section aria-label="Recent activity">
          <h2 className="text-base font-semibold text-emerald-900 mb-3 flex items-center gap-2">
            <span
              className="w-1 h-5 rounded-full inline-block"
              style={{ backgroundColor: EMERALD }}
            />
            Recent Activity
          </h2>

          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-emerald-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} style={{ color: EMERALD }} />
                <span className="text-sm font-semibold text-emerald-900">
                  My Last 10 Actions
                </span>
              </div>
              <Link
                href="/manager/activity"
                className="text-xs font-medium hover:underline"
                style={{ color: EMERALD }}
              >
                View all
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-emerald-50/60">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wide whitespace-nowrap">
                      Time
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wide whitespace-nowrap">
                      Action
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <ActivityRowSkeleton key={i} />
                    ))
                  ) : !data || data.recentActivities.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                          <AlertCircle size={24} />
                          <p className="text-sm">No activity recorded yet</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.recentActivities.slice(0, 10).map((item) => {
                      const detailFmt = formatActivityDetails(item.action, item.details);
                      return (
                      <tr
                        key={item.id}
                        className="border-t border-emerald-50 hover:bg-emerald-50/40 transition-colors"
                      >
                        <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                          {formatDateTime(item.createdAt)}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <ActionBadge action={item.action} />
                        </td>
                        <td className="px-5 py-3 text-gray-600 text-xs max-w-md">
                          {item.details ? (
                            <span
                              className="line-clamp-2 leading-relaxed"
                              title={detailFmt.title}
                            >
                              {detailFmt.text}
                            </span>
                          ) : (
                            <span className="text-gray-300 italic">—</span>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
