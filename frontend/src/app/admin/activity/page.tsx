'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, RefreshCw, AlertCircle, Filter } from 'lucide-react';
import { adminApi } from '@/lib/api';
import type { TeamMember } from '@/types';
import { formatActivityDetails } from '@/lib/activity-format';

// ─── Types ─────────────────────────────────────────────────────────────────────

type DaysFilter = 7 | 14 | 30;

interface ActivityEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: {
    name: string | null;
    mobile: string;
  };
}

// ─── Badge config ──────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  LOGIN:        { label: 'Login',        bg: 'rgba(37,99,235,0.10)',   color: '#2563eb' },
  SEARCH:       { label: 'Search',       bg: 'rgba(107,114,128,0.10)', color: '#6b7280' },
  EXPORT:       { label: 'Export',       bg: 'rgba(22,163,74,0.10)',   color: '#16a34a' },
  EDIT_PROFILE: { label: 'Edit Profile', bg: 'rgba(217,119,6,0.10)',   color: '#d97706' },
  MARK_SETTLED: { label: 'Settled',      bg: 'rgba(124,58,237,0.10)',  color: '#7c3aed' },
  PRINT:        { label: 'Print',        bg: 'rgba(79,70,229,0.10)',   color: '#4f46e5' },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action] ?? {
    label: action.replace(/_/g, ' '),
    bg: 'rgba(139,26,26,0.10)',
    color: '#8B1A1A',
  };
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DAY_OPTIONS: DaysFilter[] = [7, 14, 30];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const [days, setDays] = useState<DaysFilter>(7);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [allActivity, setAllActivity] = useState<ActivityEntry[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load team for filter dropdown ────────────────────────────────────────

  useEffect(() => {
    adminApi
      .listTeam()
      .then((data) => setTeam(data as TeamMember[]))
      .catch(() => {
        // Non-critical — filter just won't be populated
      });
  }, []);

  // ── Load activity log ────────────────────────────────────────────────────

  const loadActivity = useCallback(async (d: DaysFilter) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.teamActivity(d) as ActivityEntry[];
      setAllActivity(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivity(days);
  }, [days, loadActivity]);

  // ── Derived: filtered rows ───────────────────────────────────────────────

  const filtered = selectedMember
    ? allActivity.filter((entry) => entry.user.mobile === selectedMember)
    : allActivity;

  // ── Action summary counts ────────────────────────────────────────────────

  const actionCounts = filtered.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.action] = (acc[entry.action] ?? 0) + 1;
    return acc;
  }, {});

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#8B1A1A' }}>
          Team Activity Log
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B3A1F' }}>
          Track actions performed by team members across the platform.
        </p>
      </div>

      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Days filter */}
        <div
          className="flex items-center gap-1 p-2 rounded-xl border flex-shrink-0"
          style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
        >
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => {
                setDays(d);
                setSelectedMember('');
              }}
              className="px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200"
              style={
                days === d
                  ? { backgroundColor: '#8B1A1A', color: '#fff' }
                  : { color: '#6B3A1F' }
              }
            >
              {d} days
            </button>
          ))}
        </div>

        {/* Member filter */}
        <div className="relative flex-1 max-w-xs">
          <Filter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: '#6B3A1F' }}
          />
          <select
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            className="input-field pl-8 pr-3 appearance-none cursor-pointer"
            style={{ color: selectedMember ? '#3D1F0B' : '#6B3A1F' }}
          >
            <option value="">All Members</option>
            {team.map((m) => (
              <option key={m.id} value={m.mobile}>
                {m.name ?? m.mobile} — {m.mobile}
              </option>
            ))}
          </select>
        </div>

        {/* Entry count */}
        {!loading && !error && (
          <p className="text-sm ml-auto" style={{ color: '#6B3A1F' }}>
            <span className="font-bold" style={{ color: '#8B1A1A' }}>
              {filtered.length}
            </span>{' '}
            {filtered.length === 1 ? 'entry' : 'entries'}
          </p>
        )}
      </div>

      {/* Action summary chips */}
      {!loading && !error && filtered.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(actionCounts).map(([action, count]) => {
            const cfg = ACTION_CONFIG[action];
            return (
              <button
                key={action}
                onClick={() => {
                  // Toggle filter by clicking action badge
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
                style={{
                  backgroundColor: cfg?.bg ?? 'rgba(139,26,26,0.08)',
                  color: cfg?.color ?? '#8B1A1A',
                  borderColor: 'transparent',
                }}
              >
                {cfg?.label ?? action.replace(/_/g, ' ')}
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: '#6B3A1F' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: '#8B1A1A' }} />
          <p className="text-sm">Loading last {days} days of activity…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          className="rounded-xl border p-6 text-center"
          style={{
            backgroundColor: 'rgba(239,68,68,0.05)',
            borderColor: 'rgba(239,68,68,0.2)',
          }}
        >
          <AlertCircle size={28} className="text-red-500 mx-auto mb-2" />
          <p className="font-semibold text-red-600 mb-1">Failed to load activity</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={() => loadActivity(days)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: '#8B1A1A', color: '#fff' }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: '#6B3A1F' }}>
          <Activity size={32} style={{ opacity: 0.4 }} />
          <p className="font-semibold">No activity recorded</p>
          <p className="text-sm" style={{ opacity: 0.7 }}>
            {selectedMember
              ? 'No activity for this member in the selected period.'
              : `No team activity in the last ${days} days.`}
          </p>
        </div>
      )}

      {/* Activity table */}
      {!loading && !error && filtered.length > 0 && (
        <div
          className="rounded-xl border shadow-sm overflow-hidden"
          style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left border-b"
                  style={{ borderColor: '#E8D5C4', backgroundColor: '#FFFAF5' }}
                >
                  {['Date / Time', 'Member', 'Action', 'Details'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: '#6B3A1F' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className="border-b last:border-0 transition-colors hover:bg-[#FFFAF5]"
                    style={{
                      borderColor: '#E8D5C4',
                      backgroundColor: idx % 2 === 0 ? '#fff' : 'rgba(255,250,245,0.5)',
                    }}
                  >
                    {/* Date / Time */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: '#6B3A1F' }}
                      >
                        <Clock size={12} />
                        {formatTs(entry.createdAt)}
                      </span>
                    </td>

                    {/* Member */}
                    <td className="px-5 py-3.5">
                      <p className="font-semibold" style={{ color: '#3D1F0B' }}>
                        {entry.user.name ?? 'Unknown'}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#6B3A1F' }}>
                        {entry.user.mobile}
                      </p>
                    </td>

                    {/* Action badge */}
                    <td className="px-5 py-3.5">
                      <ActionBadge action={entry.action} />
                    </td>

                    {/* Details */}
                    <td className="px-5 py-3.5 max-w-xs">
                      {entry.details ? (
                        <span
                          className="text-xs line-clamp-2"
                          style={{ color: '#6B3A1F' }}
                          title={formatActivityDetails(entry.action, entry.details).title}
                        >
                          {formatActivityDetails(entry.action, entry.details).text}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: '#6B3A1F', opacity: 0.4 }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
