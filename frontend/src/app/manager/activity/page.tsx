'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Activity,
  Clock,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { teamApi } from '@/lib/api';
import { formatActivityDetails } from '@/lib/activity-format';

// ─── Types ────────────────────────────────────────────────────────────────────

type DaysFilter = 7 | 14 | 30;

interface ActivityEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMERALD      = '#059669';
const EMERALD_DARK = '#047857';
const DAY_OPTIONS: DaysFilter[] = [7, 14, 30];

// ─── Action badge config ──────────────────────────────────────────────────────

interface ActionConfig {
  label: string;
  bg:    string;
  text:  string;
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  SEARCH:           { label: 'Search',         bg: 'bg-gray-100',   text: 'text-gray-700'   },
  EXPORT:           { label: 'Export',          bg: 'bg-green-100',  text: 'text-green-700'  },
  EDIT_PROFILE:     { label: 'Edit Profile',    bg: 'bg-amber-100',  text: 'text-amber-700'  },
  MARK_SETTLED:     { label: 'Mark Settled',    bg: 'bg-purple-100', text: 'text-purple-700' },
  MARK_UNSETTLED:   { label: 'Mark Unsettled',  bg: 'bg-pink-100',   text: 'text-pink-700'   },
  PRINT:            { label: 'Print',           bg: 'bg-indigo-100', text: 'text-indigo-700' },
};

function getActionConfig(action: string): ActionConfig {
  return ACTION_CONFIG[action] ?? {
    label: action.replace(/_/g, ' '),
    bg:    'bg-emerald-50',
    text:  'text-emerald-700',
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const cfg = getActionConfig(action);
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

function SummaryChip({
  action,
  count,
}: {
  action: string;
  count: number;
}) {
  const cfg = getActionConfig(action);
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      <span>{cfg.label}</span>
      <span className="bg-white/60 px-1.5 py-0.5 rounded-full font-bold tabular-nums">
        {count}
      </span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerActivityPage() {
  const [days,    setDays]    = useState<DaysFilter>(7);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ── Fetch activity ────────────────────────────────────────────────────────

  const loadActivity = useCallback(async (d: DaysFilter) => {
    setLoading(true);
    setError(null);
    try {
      const data = await teamApi.myActivity(d) as ActivityEntry[];
      setEntries(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load activity';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivity(days);
  }, [days, loadActivity]);

  // ── Derived: action summary counts ───────────────────────────────────────

  const actionCounts = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.action] = (acc[entry.action] ?? 0) + 1;
    return acc;
  }, {});

  // Predictable order: known actions first, then unknowns
  const KNOWN_ORDER = ['SEARCH', 'EXPORT', 'EDIT_PROFILE', 'MARK_SETTLED', 'MARK_UNSETTLED', 'PRINT'];
  const sortedActions = [
    ...KNOWN_ORDER.filter((a) => actionCounts[a] !== undefined),
    ...Object.keys(actionCounts).filter((a) => !KNOWN_ORDER.includes(a)),
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#064e3b' }}>
          My Activity Log
        </h1>
        <p className="text-sm mt-0.5" style={{ color: EMERALD }}>
          Your personal history of actions performed on the platform.
        </p>
      </div>

      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">

        {/* Days filter toggle */}
        <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-gray-200 bg-white shadow-sm">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
              style={
                days === d
                  ? { backgroundColor: EMERALD, color: '#fff' }
                  : { color: '#4b5563' }
              }
              onMouseEnter={(e) => {
                if (days !== d) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (days !== d) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              {d} days
            </button>
          ))}
        </div>

        {/* Entry count */}
        {!loading && !error && (
          <p className="text-sm text-gray-500 sm:ml-auto">
            <span className="font-bold text-base" style={{ color: '#064e3b' }}>
              {entries.length}
            </span>{' '}
            {entries.length === 1 ? 'entry' : 'entries'} in the last {days} days
          </p>
        )}
      </div>

      {/* Summary strip */}
      {!loading && !error && entries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sortedActions.map((action) => (
            <SummaryChip key={action} action={action} count={actionCounts[action]!} />
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-20 text-gray-500">
          <RefreshCw size={28} className="animate-spin" style={{ color: EMERALD }} />
          <p className="text-sm">Loading last {days} days of activity…</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle size={28} className="text-red-500 mx-auto mb-2" />
          <p className="font-semibold text-red-700 mb-1">Failed to load activity</p>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={() => loadActivity(days)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
          <Activity size={36} className="opacity-30" />
          <p className="font-semibold text-gray-600">No activity in the last {days} days</p>
          <p className="text-sm text-gray-400 text-center max-w-xs">
            Actions you perform — like searching, exporting, or editing profiles — will appear here.
          </p>
        </div>
      )}

      {/* Activity table */}
      {!loading && !error && entries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left border-b"
                  style={{
                    backgroundColor: 'rgba(5,150,105,0.05)',
                    borderColor: 'rgba(5,150,105,0.15)',
                  }}
                >
                  {['Date / Time', 'Action', 'Details'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: EMERALD }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className="border-t border-gray-100 transition-colors"
                    style={{
                      backgroundColor:
                        idx % 2 === 0 ? '#fff' : 'rgba(236,253,245,0.30)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'rgba(236,253,245,0.55)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        idx % 2 === 0 ? '#fff' : 'rgba(236,253,245,0.30)';
                    }}
                  >
                    {/* Date / Time */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock size={12} className="flex-shrink-0" />
                        {formatTs(entry.createdAt)}
                      </span>
                    </td>

                    {/* Action badge */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <ActionBadge action={entry.action} />
                    </td>

                    {/* Details */}
                    <td className="px-5 py-3.5 max-w-xs">
                      {entry.details ? (
                        <span
                          className="text-xs text-gray-600 line-clamp-2 leading-relaxed"
                          title={formatActivityDetails(entry.action, entry.details).title}
                        >
                          {formatActivityDetails(entry.action, entry.details).text}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 select-none">—</span>
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
