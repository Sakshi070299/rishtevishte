'use client';

import { useState, useEffect } from 'react';
import { UserCog, Trash2, Phone, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Manager {
  id: string;
  name: string | null;
  mobile: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatLastLogin(ts: string | null): string {
  if (!ts) return 'Never logged in';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitial(name: string | null, mobile: string): string {
  return (name ?? mobile).charAt(0).toUpperCase();
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', mobile: '' });

  // ── Fetch ─────────────────────────────────────────────────────────────────

  async function fetchManagers() {
    try {
      const data = await adminApi.listManagers() as Manager[];
      setManagers(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load managers';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchManagers();
  }, []);

  // ── Add manager ───────────────────────────────────────────────────────────

  async function handleAdd() {
    const name = form.name.trim();
    const mobile = form.mobile.trim();

    if (!name) {
      toast.error('Please enter a name');
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      toast.error('Mobile must be exactly 10 digits');
      return;
    }

    setAdding(true);
    try {
      await adminApi.addManager(name, mobile);
      toast.success(`${name} added as manager`);
      setForm({ name: '', mobile: '' });
      await fetchManagers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add manager';
      toast.error(message);
    } finally {
      setAdding(false);
    }
  }

  // ── Remove manager ────────────────────────────────────────────────────────

  async function handleRemove(manager: Manager) {
    const displayName = manager.name ?? manager.mobile;
    if (!confirm(`Remove ${displayName} as manager? This cannot be undone.`)) return;

    setRemovingId(manager.id);
    try {
      await adminApi.removeManager(manager.id);
      toast.success(`${displayName} removed from managers`);
      await fetchManagers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove manager';
      toast.error(message);
    } finally {
      setRemovingId(null);
    }
  }

  const activeCount = managers.filter((m) => m.isActive).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#8B1A1A' }}>
          Manager Management
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B3A1F' }}>
          Manage managers who have elevated access to the platform.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div
          className="flex items-center gap-4 rounded-xl p-4 border"
          style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(139,26,26,0.08)' }}
          >
            <UserCog size={20} style={{ color: '#8B1A1A' }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: '#8B1A1A' }}>
              {loading ? '—' : managers.length}
            </p>
            <p className="text-xs" style={{ color: '#6B3A1F' }}>
              Total Managers
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-4 rounded-xl p-4 border"
          style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(22,163,74,0.08)' }}
          >
            <ShieldCheck size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {loading ? '—' : activeCount}
            </p>
            <p className="text-xs" style={{ color: '#6B3A1F' }}>
              Active Managers
            </p>
          </div>
        </div>
      </div>

      {/* Add manager form */}
      <div
        className="rounded-xl border p-5 shadow-sm"
        style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
      >
        <h2 className="font-bold mb-4" style={{ color: '#3D1F0B' }}>
          Add New Manager
        </h2>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Name */}
          <div className="flex-1">
            <label
              htmlFor="manager-name"
              className="block text-xs font-medium mb-1"
              style={{ color: '#6B3A1F' }}
            >
              Full Name
            </label>
            <input
              id="manager-name"
              type="text"
              placeholder="e.g. Priya Verma"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="input-field"
              disabled={adding}
            />
          </div>

          {/* Mobile */}
          <div className="flex-1">
            <label
              htmlFor="manager-mobile"
              className="block text-xs font-medium mb-1"
              style={{ color: '#6B3A1F' }}
            >
              Mobile Number
            </label>
            <input
              id="manager-mobile"
              type="tel"
              placeholder="10-digit mobile"
              maxLength={10}
              value={form.mobile}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, mobile: e.target.value.replace(/\D/g, '') }))
              }
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="input-field"
              disabled={adding}
            />
          </div>

          {/* Submit */}
          <div className="flex items-end">
            <button
              onClick={handleAdd}
              disabled={adding}
              className="btn-primary whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#8B1A1A',
                borderRadius: '10px',
              }}
            >
              <UserCog size={16} />
              {adding ? 'Adding…' : 'Add Manager'}
            </button>
          </div>
        </div>
      </div>

      {/* Managers list */}
      <div
        className="rounded-xl border shadow-sm overflow-hidden"
        style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
      >
        {/* List header */}
        <div
          className="px-5 py-3 border-b flex items-center justify-between"
          style={{ borderColor: '#E8D5C4', backgroundColor: '#FFFAF5' }}
        >
          <h2 className="font-bold text-sm" style={{ color: '#3D1F0B' }}>
            Managers
          </h2>
          {!loading && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(139,26,26,0.08)', color: '#8B1A1A' }}
            >
              {managers.length} total
            </span>
          )}
        </div>

        {/* Loading */}
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-2" style={{ color: '#6B3A1F' }}>
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#8B1A1A', borderTopColor: 'transparent' }}
            />
            <p className="text-sm">Loading managers…</p>
          </div>
        ) : managers.length === 0 ? (
          /* Empty state */
          <div className="py-16 flex flex-col items-center gap-3" style={{ color: '#6B3A1F' }}>
            <AlertCircle size={32} style={{ color: '#D4A843', opacity: 0.6 }} />
            <p className="text-sm font-medium">No managers added yet</p>
            <p className="text-xs" style={{ color: '#6B3A1F', opacity: 0.7 }}>
              Use the form above to add your first manager.
            </p>
          </div>
        ) : (
          /* Manager rows */
          <ul className="divide-y" style={{ borderColor: '#E8D5C4' }}>
            {managers.map((manager) => (
              <li
                key={manager.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-[#FFFAF5] transition-colors"
              >
                {/* Avatar + details */}
                <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar circle */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                    style={{
                      backgroundColor: manager.isActive
                        ? 'rgba(139,26,26,0.12)'
                        : 'rgba(107,58,31,0.08)',
                      color: manager.isActive ? '#8B1A1A' : '#6B3A1F',
                    }}
                  >
                    {getInitial(manager.name, manager.mobile)}
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm" style={{ color: '#3D1F0B' }}>
                        {manager.name ?? 'Unnamed Manager'}
                      </p>
                      {/* Role badge */}
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: 'rgba(212,168,67,0.15)',
                          color: '#8B4A00',
                        }}
                      >
                        {manager.role}
                      </span>
                      {/* Active / Inactive badge */}
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={
                          manager.isActive
                            ? {
                                backgroundColor: 'rgba(22,163,74,0.1)',
                                color: '#16a34a',
                              }
                            : {
                                backgroundColor: 'rgba(107,114,128,0.1)',
                                color: '#6b7280',
                              }
                        }
                      >
                        {manager.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: '#6B3A1F' }}
                      >
                        <Phone size={11} />
                        {manager.mobile}
                      </span>
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: '#6B3A1F' }}
                      >
                        <Clock size={11} />
                        {formatLastLogin(manager.lastLoginAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => handleRemove(manager)}
                  disabled={removingId === manager.id}
                  aria-label={`Remove manager ${manager.name ?? manager.mobile}`}
                  className="ml-4 flex-shrink-0 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: '#ef4444' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'rgba(239,68,68,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  {removingId === manager.id ? (
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: '#ef4444', borderTopColor: 'transparent' }}
                    />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
