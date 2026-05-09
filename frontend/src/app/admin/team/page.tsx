'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Phone, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';
import type { TeamMember } from '@/types';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [form, setForm] = useState({ name: '', mobile: '' });

// ── Fetch ────────────────────────────────────────────────────────────────

  async function fetchTeam() {
    try {
      const data = await adminApi.listTeam() as TeamMember[];
      setTeam(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load team members';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeam();
  }, []);

  // ── Add member ───────────────────────────────────────────────────────────

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
      await adminApi.addTeam(name, mobile);
      toast.success(`${name} added to team`);
      setForm({ name: '', mobile: '' });
      await fetchTeam();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add team member';
      toast.error(message);
    } finally {
      setAdding(false);
    }
  }

  // ── Remove member ────────────────────────────────────────────────────────

  async function confirmRemove(member: TeamMember) {
    const displayName = member.name ?? member.mobile;
    setRemovingId(member.id);
    try {
      await adminApi.removeTeam(member.id);
      toast.success(`${displayName} removed from team`);
      await fetchTeam();
      setRemoveTarget(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove team member';
      toast.error(message);
    } finally {
      setRemovingId(null);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function formatLastLogin(ts: string | null): string {
    if (!ts) return 'Never logged in';
    const date = new Date(ts);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const activeCount = team.filter((m) => m.isActive).length;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#8B1A1A' }}>
          Team Management
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B3A1F' }}>
          Manage team members who have access to the volunteer panel.
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
            <ShieldCheck size={20} style={{ color: '#8B1A1A' }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: '#8B1A1A' }}>
              {loading ? '—' : team.length}
            </p>
            <p className="text-xs" style={{ color: '#6B3A1F' }}>
              Total Members
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
              Active Members
            </p>
          </div>
        </div>
      </div>

      {/* Add member form */}
      <div
        className="rounded-xl border p-5 shadow-sm"
        style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
      >
        <h2 className="font-bold mb-4" style={{ color: '#3D1F0B' }}>
          Add New Team Member
        </h2>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Name */}
          <div className="flex-1">
            <label
              htmlFor="member-name"
              className="block text-xs font-medium mb-1"
              style={{ color: '#6B3A1F' }}
            >
              Full Name
            </label>
            <input
              id="member-name"
              type="text"
              placeholder="e.g. Rajesh Sharma"
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
              htmlFor="member-mobile"
              className="block text-xs font-medium mb-1"
              style={{ color: '#6B3A1F' }}
            >
              Mobile Number
            </label>
            <input
              id="member-mobile"
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
              <UserPlus size={16} />
              {adding ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </div>
      </div>

      {/* Team list */}
      <div
        className="rounded-xl border shadow-sm overflow-hidden"
        style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
      >
        <div
          className="px-5 py-3 border-b flex items-center justify-between"
          style={{ borderColor: '#E8D5C4', backgroundColor: '#FFFAF5' }}
        >
          <h2 className="font-bold text-sm" style={{ color: '#3D1F0B' }}>
            Team Members
          </h2>
          {!loading && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(139,26,26,0.08)', color: '#8B1A1A' }}
            >
              {team.length} total
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center gap-2" style={{ color: '#6B3A1F' }}>
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#8B1A1A', borderTopColor: 'transparent' }}
            />
            <p className="text-sm">Loading team members…</p>
          </div>
        ) : team.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3" style={{ color: '#6B3A1F' }}>
            <AlertCircle size={32} style={{ color: '#D4A843', opacity: 0.6 }} />
            <p className="text-sm font-medium">No team members added yet</p>
            <p className="text-xs" style={{ color: '#6B3A1F', opacity: 0.7 }}>
              Use the form above to add your first member.
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: '#E8D5C4' }}>
            {team.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-[#FFFAF5] transition-colors"
              >
                {/* Avatar + details */}
                <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar circle */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                    style={{
                      backgroundColor: member.isActive
                        ? 'rgba(139,26,26,0.12)'
                        : 'rgba(107,58,31,0.08)',
                      color: member.isActive ? '#8B1A1A' : '#6B3A1F',
                    }}
                  >
                    {(member.name ?? member.mobile).charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm" style={{ color: '#3D1F0B' }}>
                        {member.name ?? 'Unnamed Member'}
                      </p>
                      {/* Active badge */}
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={
                          member.isActive
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
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: '#6B3A1F' }}
                      >
                        <Phone size={11} />
                        {member.mobile}
                      </span>
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: '#6B3A1F' }}
                      >
                        <Clock size={11} />
                        {formatLastLogin(member.lastLoginAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => setRemoveTarget(member)}
                  disabled={removingId === member.id}
                  aria-label={`Remove ${member.name ?? member.mobile}`}
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
                  {removingId === member.id ? (
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

      {removeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !removingId) setRemoveTarget(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-5 shadow-2xl"
            style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
          >
            <h3 className="text-base font-bold mb-2" style={{ color: '#3D1F0B' }}>
              Remove Team Member
            </h3>
            <p className="text-sm mb-5" style={{ color: '#6B3A1F' }}>
              Remove{' '}
              <span className="font-semibold">
                {removeTarget.name ?? removeTarget.mobile}
              </span>{' '}
              from the team? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRemoveTarget(null)}
                disabled={!!removingId}
                className="px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-50"
                style={{ borderColor: '#E8D5C4', color: '#6B3A1F' }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmRemove(removeTarget)}
                disabled={!!removingId}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 inline-flex items-center gap-2"
                style={{ backgroundColor: '#dc2626' }}
              >
                {removingId ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {removingId ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
