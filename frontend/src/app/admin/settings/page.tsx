'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Settings,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';
import type { SiteSetting } from '@/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type LimitOption = 1 | 3 | 5 | 7 | 10 | 15 | 20;

const LIMIT_OPTIONS: LimitOption[] = [1, 3, 5, 7, 10, 15, 20];

// ─── Sub-component: individual setting row ──────────────────────────────────────

interface SettingRowProps {
  setting: SiteSetting;
  onSave: (key: string, value: string) => Promise<void>;
}

function SettingRow({ setting, onSave }: SettingRowProps) {
  const [value, setValue] = useState(setting.value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local value in sync when parent data refreshes
  useEffect(() => {
    setValue(setting.value);
  }, [setting.value]);

  async function handleBlur() {
    if (value === setting.value) return; // no change
    setSaving(true);
    try {
      await onSave(setting.key, value);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2000);
    } catch {
      // onSave shows toast on error — just reset field to last good value
      setValue(setting.value);
    } finally {
      setSaving(false);
    }
  }

  const label = setting.label ?? setting.key;

  return (
    <div className="flex items-center gap-4 py-3 border-b last:border-0" style={{ borderColor: '#E8D5C4' }}>
      {/* Label */}
      <label
        htmlFor={`setting-${setting.key}`}
        className="text-sm flex-shrink-0 font-medium"
        style={{ color: '#3D1F0B', minWidth: '200px' }}
      >
        {label}
      </label>

      {/* Input */}
      <div className="flex-1 flex items-center gap-2">
        <input
          id={`setting-${setting.key}`}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          className="input-field"
          disabled={saving}
        />

        {/* Status indicator */}
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {saving && (
            <div
              className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#8B1A1A', borderTopColor: 'transparent' }}
            />
          )}
          {!saving && saved && (
            <CheckCircle size={16} className="text-green-500" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [weeklyLimit, setWeeklyLimit] = useState<LimitOption>(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingLimit, setUpdatingLimit] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ cleanedSessions: number } | null>(null);

  // ── Fetch settings ────────────────────────────────────────────────────────

  async function fetchSettings() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getSettings() as SiteSetting[];
      setSettings(data);

      // Pre-populate weekly limit from settings
      const wlSetting = data.find((s) => s.key === 'weekly_profile_limit');
      if (wlSetting) {
        const parsed = parseInt(wlSetting.value, 10);
        if (LIMIT_OPTIONS.includes(parsed as LimitOption)) {
          setWeeklyLimit(parsed as LimitOption);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  // ── Update a single setting (called from SettingRow on blur) ─────────────

  async function handleUpdateSetting(key: string, value: string): Promise<void> {
    await adminApi.updateSetting(key, value);
    toast.success('Setting saved');
    // Refresh local state silently
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value } : s))
    );
  }

  // ── Update weekly limit ───────────────────────────────────────────────────

  async function handleUpdateLimit() {
    setUpdatingLimit(true);
    try {
      await adminApi.updateWeeklyLimit(weeklyLimit);
      toast.success(`Weekly profile limit updated to ${weeklyLimit}`);
      // Reflect in settings list
      setSettings((prev) =>
        prev.map((s) =>
          s.key === 'weekly_profile_limit'
            ? { ...s, value: String(weeklyLimit) }
            : s
        )
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update limit';
      toast.error(message);
    } finally {
      setUpdatingLimit(false);
    }
  }

  // ── System cleanup ────────────────────────────────────────────────────────

  async function handleCleanup() {
    if (
      !confirm(
        'Run system cleanup? This will clear expired sessions and stale data. Continue?'
      )
    )
      return;

    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const result = await adminApi.runCleanup() as { cleanedSessions: number };
      setCleanupResult(result);
      toast.success(`Cleanup complete — ${result.cleanedSessions} sessions cleared`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Cleanup failed';
      toast.error(message);
    } finally {
      setCleanupLoading(false);
    }
  }

  // ── Filtered settings: exclude weekly_profile_limit (shown separately) ───

  const otherSettings = settings.filter((s) => s.key !== 'weekly_profile_limit');

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#8B1A1A' }}>
          Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B3A1F' }}>
          Configure platform behaviour and site-wide preferences.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: '#6B3A1F' }}>
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#8B1A1A', borderTopColor: 'transparent' }}
          />
          <p className="text-sm">Loading settings…</p>
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
          <p className="font-semibold text-red-600 mb-1">Failed to load settings</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchSettings}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: '#8B1A1A', color: '#fff' }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Weekly Profile Limit ──────────────────────────────────────── */}
          <section
            className="rounded-xl border p-5 shadow-sm"
            style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Settings size={18} style={{ color: '#8B1A1A' }} />
              <h2 className="font-bold" style={{ color: '#3D1F0B' }}>
                Weekly Profile Limit
              </h2>
            </div>
            <p className="text-sm mb-4" style={{ color: '#6B3A1F' }}>
              Number of profiles a registered user can view per week (Sunday–Saturday).
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {/* Limit picker chips */}
              <div
                className="flex items-center gap-1 p-1 rounded-xl border flex-wrap"
                style={{ backgroundColor: '#FFFAF5', borderColor: '#E8D5C4' }}
              >
                {LIMIT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setWeeklyLimit(n)}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200"
                    style={
                      weeklyLimit === n
                        ? { backgroundColor: '#8B1A1A', color: '#fff' }
                        : { color: '#6B3A1F' }
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>

              <span className="text-sm" style={{ color: '#6B3A1F' }}>
                profiles / week
              </span>

              <button
                onClick={handleUpdateLimit}
                disabled={updatingLimit}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ml-auto"
                style={{ backgroundColor: '#8B1A1A', color: '#fff' }}
              >
                {updatingLimit ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save size={14} /> Update Limit
                  </>
                )}
              </button>
            </div>
          </section>

          {/* ── Site Settings ─────────────────────────────────────────────── */}
          {otherSettings.length > 0 && (
            <section
              className="rounded-xl border p-5 shadow-sm"
              style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Settings size={18} style={{ color: '#8B1A1A' }} />
                <h2 className="font-bold" style={{ color: '#3D1F0B' }}>
                  Site Settings
                </h2>
              </div>
              <p className="text-sm mb-4" style={{ color: '#6B3A1F' }}>
                Changes are saved automatically when you click away from a field.
              </p>

              <div>
                {otherSettings.map((s) => (
                  <SettingRow key={s.id} setting={s} onSave={handleUpdateSetting} />
                ))}
              </div>
            </section>
          )}

          {/* ── System Cleanup ────────────────────────────────────────────── */}
          <section
            className="rounded-xl border p-5 shadow-sm"
            style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Trash2 size={18} style={{ color: '#8B1A1A' }} />
              <h2 className="font-bold" style={{ color: '#3D1F0B' }}>
                System Cleanup
              </h2>
            </div>
            <p className="text-sm mb-5" style={{ color: '#6B3A1F' }}>
              Removes expired sessions, stale OTP records, and other temporary data from
              the database. Safe to run at any time.
            </p>

            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={handleCleanup}
                disabled={cleanupLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed border"
                style={{
                  borderColor: '#8B1A1A',
                  color: '#8B1A1A',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!cleanupLoading) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#8B1A1A';
                    (e.currentTarget as HTMLElement).style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = '#8B1A1A';
                }}
              >
                {cleanupLoading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" /> Running cleanup…
                  </>
                ) : (
                  <>
                    <Trash2 size={15} /> Run Cleanup
                  </>
                )}
              </button>

              {/* Result banner */}
              {cleanupResult && !cleanupLoading && (
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                  style={{
                    backgroundColor: 'rgba(22,163,74,0.08)',
                    color: '#16a34a',
                  }}
                >
                  <CheckCircle size={15} />
                  {cleanupResult.cleanedSessions === 0
                    ? 'Nothing to clean up — system is tidy.'
                    : `${cleanupResult.cleanedSessions} expired session${
                        cleanupResult.cleanedSessions === 1 ? '' : 's'
                      } cleared successfully.`}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
