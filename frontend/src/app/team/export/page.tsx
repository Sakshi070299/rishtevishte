"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Download,
  RefreshCw,
  AlertCircle,
  Package,
  FileDown,
} from "lucide-react";
import { teamApi } from "@/lib/api";
import type { Profile } from "@/types";
import { buildProfileCsv } from "@/lib/profile-csv";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExportBatchResponse {
  profiles: Profile[];
  batch: number;
  batchSize: number;
  total: number;
  totalBatches: number;
  limit?: number;
}

const PREVIEW_ROW_OPTIONS = [25, 50, 75, 100] as const;
type PreviewRowOption = (typeof PREVIEW_ROW_OPTIONS)[number];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    SETTLED: "bg-blue-100 text-blue-700",
    PENDING_PAYMENT: "bg-yellow-100 text-yellow-700",
    INACTIVE: "bg-gray-100 text-gray-600",
  };
  const cls = styles[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function triggerCsvDownload(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExportPage() {
  const [batch, setBatch] = useState<ExportBatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRowOption>(25);

  const fetchExport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await teamApi.exportBatch(
        previewRows,
      )) as ExportBatchResponse;
      const profiles = Array.isArray(data.profiles) ? data.profiles : [];
      setBatch({
        ...data,
        profiles,
        total: data.total ?? profiles.length,
        batchSize: profiles.length,
        totalBatches: 1,
        batch: 1,
        limit: data.limit ?? previewRows,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }, [previewRows]);

  useEffect(() => {
    fetchExport();
  }, [fetchExport]);

  function handleDownload() {
    if (!batch || batch.profiles.length === 0) {
      toast.error("No profiles to download");
      return;
    }
    const csv = buildProfileCsv(batch.profiles);
    const filename = `rishtenate-profiles-${batch.profiles.length}.csv`;
    triggerCsvDownload(csv, filename);
    toast.success(`Downloaded ${batch.profiles.length} profiles`);
  }

  const profiles = batch?.profiles ?? [];
  const directoryTotal = batch?.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-900">Export Profiles</h1>
        <p className="text-sm text-blue-600 mt-0.5">
          Row count is applied on the server via the limit parameter. Choose 100
          to load every profile, then download CSV.
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50">
        <Package size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 leading-relaxed">
          <span className="font-semibold">Export:</span> Preview rows come from
          the API <span className="font-semibold">limit</span> (25 / 50 / 75 /
          100; 100 = all). CSV contains exactly the rows returned for the
          current limit — pick 100 before download for a full export.
        </div>
      </div>

      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle size={28} className="text-red-500 mx-auto mb-2" />
          <p className="font-semibold text-red-700 mb-1">Failed to load</p>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={() => fetchExport()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {!error && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Preview</h2>

              <button
                onClick={handleDownload}
                disabled={loading || profiles.length === 0}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#1D4ED8] text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FileDown size={15} />
                Download as CSV
              </button>
            </div>

            {loading && (
              <div className="divide-y divide-gray-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4 px-5 py-4 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-24" />
                    <div className="h-4 bg-gray-100 rounded w-36" />
                    <div className="h-4 bg-gray-100 rounded w-16" />
                    <div className="h-4 bg-gray-100 rounded w-28" />
                    <div className="h-4 bg-gray-100 rounded w-20" />
                  </div>
                ))}
              </div>
            )}

            {!loading && batch && (
              <div className="overflow-x-auto max-h-[min(62vh,1200px)] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 shadow-sm">
                    <tr className="bg-blue-50 text-left">
                      {["Reg #", "Full Name", "Gender", "Phone", "Status"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-blue-800 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-12 text-center text-gray-500 text-sm"
                        >
                          <Download
                            size={24}
                            className="mx-auto mb-2 opacity-30"
                          />
                          No profiles found.
                        </td>
                      </tr>
                    ) : (
                      profiles.map((p, idx) => (
                        <tr
                          key={p.id}
                          className="border-t border-gray-100 hover:bg-blue-50/40 transition-colors"
                          style={{
                            backgroundColor:
                              idx % 2 === 0 ? "#fff" : "rgba(239,246,255,0.35)",
                          }}
                        >
                          <td className="px-5 py-3.5 font-mono text-xs text-gray-600 whitespace-nowrap">
                            {p.registrationNumber}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-gray-900 whitespace-nowrap">
                            {p.fullName}
                          </td>
                          <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap">
                            {p.gender === "BRIDE" ? "Bride" : "Groom"}
                          </td>
                          <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap">
                            {p.guardianPhone}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <StatusBadge status={p.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <label
                htmlFor="export-row-limit"
                className="text-xs font-medium text-gray-600 whitespace-nowrap"
              >
                Rows
              </label>
              <select
                id="export-row-limit"
                value={previewRows}
                disabled={loading}
                onChange={(e) =>
                  setPreviewRows(Number(e.target.value) as PreviewRowOption)
                }
                className="rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-900 py-1.5 px-2.5 min-w-[9.5rem] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/35 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {PREVIEW_ROW_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n === 100 ? `${n} — all profiles` : `${n} rows`}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading
                ? "Loading profiles…"
                : profiles.length === 0
                  ? "No profiles"
                  : `Showing ${profiles.length} of ${directoryTotal} profile${directoryTotal === 1 ? "" : "s"} (API limit ${previewRows}${previewRows === 100 ? ", all rows" : ""})`}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
