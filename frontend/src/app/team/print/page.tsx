"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Printer,
  CalendarDays,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  Search,
} from "lucide-react";
import { teamApi } from "@/lib/api";
import type { Profile } from "@/types";
import { downloadBiodata } from "@/lib/download-biodata";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDefaultDates(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 14);
  return { from: toYMD(from), to: toYMD(to) };
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function diffDays(from: string, to: string): number {
  return Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24),
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrintPage() {
  const defaults = getDefaultDates();

  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Validation ────────────────────────────────────────────────────────────

  const rangeValid =
    fromDate && toDate && new Date(fromDate) <= new Date(toDate);
  const rangeExceed = rangeValid && diffDays(fromDate, toDate) > 14;

  // ── Load registrations ────────────────────────────────────────────────────

  const handleLoad = useCallback(async () => {
    if (!rangeValid) {
      toast.error("Please select a valid date range");
      return;
    }
    if (rangeExceed) {
      toast.error("Can only print registrations from the last 2 weeks");
      return;
    }

    setLoading(true);
    setError(null);
    setLoaded(false);

    try {
      const data = (await teamApi.printRegistrations(
        fromDate,
        toDate,
      )) as Profile[];
      setProfiles(data);
      setLoaded(true);
      if (data.length === 0) {
        toast.info("No registrations found for this date range");
      } else {
        toast.success(
          `Loaded ${data.length} registration${data.length !== 1 ? "s" : ""}`,
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load registrations";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, rangeValid, rangeExceed]);

  // ── Print ─────────────────────────────────────────────────────────────────

  function handlePrint() {
    if (profiles.length === 0) {
      toast.error("No registrations to print");
      return;
    }
    window.print();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Print-optimized styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-table-section,
          #print-table-section * {
            visibility: visible !important;
          }
          #print-table-section {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            background: white !important;
          }
          #print-table-section table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 11px !important;
          }
          #print-table-section th,
          #print-table-section td {
            border: 1px solid #374151 !important;
            padding: 6px 8px !important;
            text-align: left !important;
            color: #000 !important;
            background: white !important;
          }
          #print-table-section th {
            background: #e5e7eb !important;
            font-weight: 600 !important;
          }
          #print-table-section h2 {
            font-size: 16px !important;
            font-weight: bold !important;
            margin-bottom: 8px !important;
            color: #000 !important;
          }
          #print-table-section .print-meta {
            font-size: 10px !important;
            color: #374151 !important;
            margin-bottom: 12px !important;
          }
          @page {
            margin: 12mm !important;
            size: A4 landscape !important;
          }
        }
      `}</style>

      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-blue-900">
            Print Registrations
          </h1>
          <p className="text-sm text-blue-600 mt-0.5">
            Print registration forms for a selected date range.
          </p>
        </div>

        {/* Constraint warning */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <AlertTriangle
            size={18}
            className="text-amber-600 flex-shrink-0 mt-0.5"
          />
          <p className="text-sm text-amber-800 leading-relaxed">
            <span className="font-semibold">Restriction:</span> Only
            registrations from the last 2 weeks are printable. Date ranges
            exceeding 14 days will be rejected.
          </p>
        </div>

        {/* Date range picker card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-sm">
            <CalendarDays size={16} className="text-blue-600" />
            Select Date Range
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {/* From date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                max={toDate || toYMD(new Date())}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setLoaded(false);
                  setError(null);
                }}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* To date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                max={toYMD(new Date())}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setLoaded(false);
                  setError(null);
                }}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Range violation notice */}
          {rangeExceed && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Selected range is {diffDays(fromDate, toDate)} days — exceeds
                the 14-day limit.
              </p>
            </div>
          )}

          {/* Load button */}
          <button
            onClick={handleLoad}
            disabled={loading || !rangeValid || !!rangeExceed}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#1D4ED8] text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <Search size={15} />
                Load Registrations
              </>
            )}
          </button>
        </div>

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle size={28} className="text-red-500 mx-auto mb-2" />
            <p className="font-semibold text-red-700 mb-1">
              Failed to load registrations
            </p>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={handleLoad}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        )}

        {/* Results */}
        {loaded && !error && (
          <div id="print-table-section">
            {/* Print header — only visible when printing */}
            <div className="print:block">
              <h2 className="text-lg font-bold text-blue-900 hidden print:block">
                RishteNate — Registrations
              </h2>
              <p className="print-meta hidden print:block text-xs text-gray-500 mb-3">
                Date range: {formatDate(fromDate)} to {formatDate(toDate)}{" "}
                &bull; Total: {profiles.length} registrations
              </p>
            </div>

            {/* Screen header with count + print button */}
            <div className="flex items-center justify-between mb-3 print:hidden">
              <p className="text-sm font-medium text-gray-700">
                <span className="font-bold text-blue-900 text-lg">
                  {profiles.length}
                </span>{" "}
                registration{profiles.length !== 1 ? "s" : ""} found
                {profiles.length > 0 && (
                  <span className="text-gray-400 ml-1">
                    ({formatDate(fromDate)} — {formatDate(toDate)})
                  </span>
                )}
              </p>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {profiles.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <Printer size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="font-semibold text-gray-500">
                    No registrations found
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Try adjusting the date range.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-blue-50 text-left border-b border-blue-100">
                        {[
                          "Reg #",
                          "Full Name",
                          "Gender",
                          "Father Name",
                          "Phone",
                          "Registered On",
                          "Action",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-blue-800 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((p, idx) => (
                        <tr
                          key={p.id}
                          className="border-t border-gray-100 hover:bg-blue-50/30 transition-colors"
                          style={{
                            backgroundColor:
                              idx % 2 === 0 ? "#fff" : "rgba(239,246,255,0.30)",
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
                            {p.fatherName}
                          </td>
                          <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap">
                            {p.guardianPhone}
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                            {formatDate(p.createdAt)}
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                            <button
                              onClick={() => downloadBiodata(p)}
                              className="rounded-lg bg-green-50   hover:bg-green-100 text-green-600 font-medium inline-flex items-center gap-1 text-xs p-1.5 transition-colors ml-5"
                            >
                              <Printer className="text-green-600 size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
