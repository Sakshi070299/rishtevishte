'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Download,
  RefreshCw,
  AlertCircle,
  FileDown,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import { teamApi } from '@/lib/api';
import type { Profile } from '@/types';
import { buildProfileCsv } from '@/lib/profile-csv';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportStatus = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface ProfilesResponse {
  data: Profile[];
  total: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMERALD      = '#059669';
const EMERALD_DARK = '#047857';
const FETCH_LIMIT  = 1000;

const STATUS_OPTIONS: { value: ExportStatus; label: string; description: string }[] = [
  {
    value: 'ACTIVE',
    label: 'Active Profiles',
    description: 'Export all currently active registered profiles',
  },
  {
    value: 'INACTIVE',
    label: 'Inactive Profiles',
    description: 'Export deactivated / archived profiles',
  },
  {
    value: 'ALL',
    label: 'All Profiles',
    description: 'Export every profile regardless of status',
  },
];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE:          'bg-green-100 text-green-700',
    SETTLED:         'bg-blue-100 text-blue-700',
    PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700',
    INACTIVE:        'bg-red-100 text-red-600',
  };
  const cls = styles[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function triggerCsvDownload(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = window.URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function formatDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagerExportPage() {
  const [selectedStatus, setSelectedStatus] = useState<ExportStatus>('ACTIVE');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [preview, setPreview]               = useState<Profile[] | null>(null);
  const [totalFetched, setTotalFetched]     = useState(0);
  const [lastExported, setLastExported]     = useState<string | null>(null);

  // ── Fetch all profiles (no pagination limit like team) ────────────────────

  const fetchProfiles = useCallback(async (): Promise<Profile[]> => {
    const parts: string[] = [`limit=${FETCH_LIMIT}`, 'page=1'];
    if (selectedStatus !== 'ALL') {
      parts.push(`status=${selectedStatus}`);
    }
    const result = (await teamApi.searchProfiles(parts.join('&'))) as ProfilesResponse;
    return result.data ?? [];
  }, [selectedStatus]);

  // ── Load preview ──────────────────────────────────────────────────────────

  const handleLoadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const profiles = await fetchProfiles();
      setPreview(profiles);
      setTotalFetched(profiles.length);
      if (profiles.length === 0) {
        toast.info('No profiles found for this filter.');
      } else {
        toast.success(`Loaded ${profiles.length} profile${profiles.length !== 1 ? 's' : ''}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch profiles';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchProfiles]);

  // ── Download CSV ──────────────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    if (preview !== null && preview.length > 0) {
      // Use already-fetched preview data
      const csv       = buildProfileCsv(preview);
      const statusStr = selectedStatus.toLowerCase();
      const filename  = `rishtenate-${statusStr}-profiles-${formatDateStamp()}.csv`;
      triggerCsvDownload(csv, filename);
      setLastExported(filename);
      toast.success(`Downloaded ${preview.length} profiles as ${filename}`);
      return;
    }

    // No preview loaded yet — fetch then download
    setLoading(true);
    setError(null);
    try {
      const profiles = await fetchProfiles();
      if (profiles.length === 0) {
        toast.info('No profiles to export for the selected filter.');
        setLoading(false);
        return;
      }
      const csv       = buildProfileCsv(profiles);
      const statusStr = selectedStatus.toLowerCase();
      const filename  = `rishtenate-${statusStr}-profiles-${formatDateStamp()}.csv`;
      triggerCsvDownload(csv, filename);
      setPreview(profiles);
      setTotalFetched(profiles.length);
      setLastExported(filename);
      toast.success(`Downloaded ${profiles.length} profiles as ${filename}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export profiles';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [preview, fetchProfiles, selectedStatus]);

  // ── Reset when status changes ─────────────────────────────────────────────

  function handleStatusChange(value: ExportStatus) {
    setSelectedStatus(value);
    setPreview(null);
    setError(null);
    setLastExported(null);
  }

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: '#064e3b' }}
        >
          Unlimited Export
        </h1>
        <p className="text-sm mt-0.5" style={{ color: EMERALD }}>
          Export all profiles as CSV — no batch limit.
        </p>
      </div>

      {/* Manager privilege notice */}
      <div
        className="flex items-start gap-3 p-4 rounded-xl border"
        style={{ backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' }}
      >
        <Briefcase size={18} style={{ color: EMERALD }} className="flex-shrink-0 mt-0.5" />
        <div className="text-sm leading-relaxed" style={{ color: EMERALD_DARK }}>
          <span className="font-semibold">Manager export:</span> Unlike the Team panel, you can
          export up to{' '}
          <span className="font-semibold">{FETCH_LIMIT.toLocaleString('en-IN')} profiles</span> in
          a single CSV download. Select a status filter, load a preview, and download.
        </div>
      </div>

      {/* ── Status filter cards ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4 text-sm">Select Export Type</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {STATUS_OPTIONS.map(({ value, label, description }) => {
            const active = selectedStatus === value;
            return (
              <button
                key={value}
                onClick={() => handleStatusChange(value)}
                className="flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200"
                style={{
                  borderColor:     active ? EMERALD : '#e5e7eb',
                  backgroundColor: active ? '#ECFDF5' : '#fff',
                }}
              >
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                  style={{
                    borderColor:     active ? EMERALD : '#d1d5db',
                    backgroundColor: active ? EMERALD : 'transparent',
                  }}
                >
                  {active && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: active ? EMERALD_DARK : '#111827' }}
                  >
                    {label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Load preview */}
        <button
          onClick={handleLoadPreview}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderColor: EMERALD,
            color:       EMERALD,
            backgroundColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#ECFDF5';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          {loading ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              Loading…
            </>
          ) : (
            <>
              <Download size={15} />
              Load Preview
            </>
          )}
        </button>

        {/* Download CSV */}
        <button
          onClick={handleDownload}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: loading ? '#d1d5db' : EMERALD }}
          onMouseEnter={(e) => {
            if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = EMERALD_DARK;
          }}
          onMouseLeave={(e) => {
            if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = EMERALD;
          }}
        >
          {loading ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              Preparing…
            </>
          ) : (
            <>
              <FileDown size={15} />
              Download as CSV
            </>
          )}
        </button>
      </div>

      {/* Last exported notice */}
      {lastExported && !loading && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium"
          style={{ backgroundColor: '#ECFDF5', borderColor: '#6EE7B7', color: EMERALD_DARK }}
        >
          <CheckCircle2 size={14} style={{ color: EMERALD }} />
          Last exported: <span className="font-mono">{lastExported}</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle size={28} className="text-red-500 mx-auto mb-2" />
          <p className="font-semibold text-red-700 mb-1">Failed to export</p>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* ── Preview table ── */}
      {preview !== null && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Export Preview</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {totalFetched === 0
                  ? 'No profiles in this selection'
                  : `${totalFetched} profile${totalFetched !== 1 ? 's' : ''} ready — showing first 20`}
              </p>
            </div>
            {totalFetched > 0 && (
              <button
                onClick={handleDownload}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: EMERALD }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = EMERALD_DARK;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = EMERALD;
                }}
              >
                <FileDown size={15} />
                Download CSV
              </button>
            )}
          </div>

          {/* Empty */}
          {preview.length === 0 ? (
            <div className="px-5 py-14 text-center text-gray-400">
              <Download size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No profiles match the selected filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-left border-b border-gray-100"
                    style={{ backgroundColor: 'rgba(5,150,105,0.05)' }}
                  >
                    {['Reg #', 'Full Name', 'Gender', 'Phone', 'Status', 'City', 'Registered On'].map((h) => (
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
                  {preview.slice(0, 20).map((p, idx) => (
                    <tr
                      key={p.id}
                      className="border-t border-gray-100 hover:bg-emerald-50/30 transition-colors"
                      style={{ backgroundColor: idx % 2 === 0 ? '#fff' : 'rgba(236,253,245,0.35)' }}
                    >
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600 whitespace-nowrap">
                        {p.registrationNumber}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900 whitespace-nowrap">
                        {p.fullName}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap">
                        {p.gender === 'BRIDE' ? 'Bride' : 'Groom'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600 whitespace-nowrap">
                        {p.guardianPhone}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap text-xs">
                        {p.city ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 whitespace-nowrap text-xs">
                        {new Date(p.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {preview.length > 20 && (
                <div
                  className="px-5 py-3 border-t border-gray-100 text-xs text-center font-medium"
                  style={{ color: EMERALD, backgroundColor: 'rgba(236,253,245,0.4)' }}
                >
                  + {(preview.length - 20).toLocaleString('en-IN')} more profile{preview.length - 20 !== 1 ? 's' : ''} included in the CSV download
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
