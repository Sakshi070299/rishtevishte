'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, TrendingUp, IndianRupee, Activity, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { adminApi } from '@/lib/api';
import type { DashboardStats, Profile, Donation } from '@/types';

// ─── Status badge helpers ────────────────────────────────────────────────────

function ProfileStatusBadge({ status }: { status: Profile['status'] }) {
  const map: Record<Profile['status'], { label: string; className: string }> = {
    ACTIVE:          { label: 'Active',          className: 'bg-green-100 text-green-800 border border-green-200' },
    PENDING_PAYMENT: { label: 'Pending Payment',  className: 'bg-yellow-100 text-yellow-800 border border-yellow-200' },
    SETTLED:         { label: 'Settled',          className: 'bg-blue-100 text-blue-800 border border-blue-200' },
    INACTIVE:        { label: 'Inactive',         className: 'bg-red-100 text-red-800 border border-red-200' },
  };
  const cfg = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-700 border border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function DonationTypeBadge({ type }: { type: Donation['type'] }) {
  const map: Record<Donation['type'], { label: string; className: string }> = {
    REGISTRATION: { label: 'Registration', className: 'bg-[#FFF8F0] text-[#8B1A1A] border border-[#D4A843]/40' },
    GENERAL:      { label: 'General',      className: 'bg-purple-50 text-purple-800 border border-purple-200' },
  };
  const cfg = map[type] ?? { label: type, className: 'bg-gray-100 text-gray-700 border border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    COMPLETED: { label: 'Completed', className: 'bg-green-100 text-green-800 border border-green-200',  icon: <CheckCircle size={11} className="mr-1" /> },
    PENDING:   { label: 'Pending',   className: 'bg-yellow-100 text-yellow-800 border border-yellow-200', icon: <Clock size={11} className="mr-1" /> },
    FAILED:    { label: 'Failed',    className: 'bg-red-100 text-red-800 border border-red-200',        icon: <XCircle size={11} className="mr-1" /> },
  };
  const cfg = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-700 border border-gray-200', icon: <AlertCircle size={11} className="mr-1" /> };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.className}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sub?: string;
  accentColor: string;
}

function StatCard({ icon, value, label, sub, accentColor }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8D5C4] shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${accentColor}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-[#8B1A1A] leading-tight truncate">{value}</p>
        <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#F0E6DA] last:border-0 animate-pulse">
      <div className="h-4 bg-gray-100 rounded w-1/3" />
      <div className="h-4 bg-gray-100 rounded w-1/4 ml-auto" />
      <div className="h-5 bg-gray-100 rounded-full w-16" />
    </div>
  );
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatINR(paisa: number): string {
  return `₹${(paisa/100).toLocaleString('en-IN')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Main dashboard page ─────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats]             = useState<DashboardStats | null>(null);
  const [profiles, setProfiles]       = useState<Profile[]>([]);
  const [donations, setDonations]     = useState<Donation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsData, profilesData, donationsData] = await Promise.all([
        adminApi.dashboard() as Promise<DashboardStats>,
        adminApi.listProfiles('limit=5') as Promise<{ data: Profile[] }>,
        adminApi.listDonations('limit=5') as Promise<{ data: Donation[] }>,
      ]);

      setStats(statsData);
      setProfiles(profilesData?.data ?? []);
      setDonations(donationsData?.data ?? []);
      setLastRefreshed(new Date());
    } catch {
      // silent — auth errors redirect via api wrapper
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const statCards = stats
    ? [
        {
          icon: <Users size={22} className="text-[#8B1A1A]" />,
          value: stats.profiles.total.toLocaleString('en-IN'),
          label: 'Total Profiles',
          sub: `+${stats.profiles.newThisPeriod} this period`,
          accentColor: 'bg-[#FFF8F0]',
        },
        {
          icon: <TrendingUp size={22} className="text-green-700" />,
          value: stats.profiles.active.toLocaleString('en-IN'),
          label: 'Active Profiles',
          sub: `${stats.profiles.settled} settled · ${stats.profiles.pending} pending`,
          accentColor: 'bg-green-50',
        },
        {
          icon: <IndianRupee size={22} className="text-[#D4A843]" />,
          value: formatINR(stats.donations.general.totalAmount *100),
          label: 'Total Donations',
          sub: `${stats.donations.registration.count + stats.donations.general.count} transactions`,
          accentColor: 'bg-amber-50',
        },
        {
          icon: <Activity size={22} className="text-blue-700" />,
          value: stats.activeTeamMembers.toLocaleString('en-IN'),
          label: 'Active Team Members',
          accentColor: 'bg-blue-50',
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#FFF8F0]">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#8B1A1A] tracking-tight">Dashboard</h1>
          {lastRefreshed && (
            <p className="text-xs text-gray-400 mt-1">
              Last updated: {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        <button
          onClick={() => loadAll(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E8D5C4] bg-white text-[#8B1A1A] text-sm font-medium shadow-sm hover:bg-[#FFF8F0] hover:border-[#D4A843] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E8D5C4] shadow-sm p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100" />
                  <div className="flex-1">
                    <div className="h-7 bg-gray-100 rounded w-20 mb-2" />
                    <div className="h-4 bg-gray-100 rounded w-32 mb-1" />
                    <div className="h-3 bg-gray-100 rounded w-24" />
                  </div>
                </div>
              </div>
            ))
          : statCards.map((card, i) => <StatCard key={i} {...card} />)}
      </div>

      {/* ── Recent activity panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Registrations */}
        <div className="bg-white rounded-2xl border border-[#E8D5C4] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0E6DA] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#8B1A1A]" />
              <h2 className="font-semibold text-[#8B1A1A]">Recent Registrations</h2>
            </div>
            <span className="text-xs text-gray-400">Last 5</span>
          </div>

          <div className="divide-y divide-[#F0E6DA]">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5">
                    <SkeletonRow />
                  </div>
                ))
              : profiles.length === 0
              ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">
                  No profiles found
                </div>
              )
              : profiles.map((profile) => (
                <div key={profile.id} className="px-5 py-3 flex items-center gap-3 hover:bg-[#FFFAF5] transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{profile.fullName}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{profile.registrationNumber}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <ProfileStatusBadge status={profile.status} />
                    <span className="text-[11px] text-gray-400">{formatDate(profile.createdAt)}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Recent Donations */}
        <div className="bg-white rounded-2xl border border-[#E8D5C4] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0E6DA] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IndianRupee size={18} className="text-[#D4A843]" />
              <h2 className="font-semibold text-[#8B1A1A]">Recent Donations</h2>
            </div>
            <span className="text-xs text-gray-400">Last 5</span>
          </div>

          <div className="divide-y divide-[#F0E6DA]">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5">
                    <SkeletonRow />
                  </div>
                ))
              : donations.length === 0
              ? (
                <div className="px-5 py-10 text-center text-sm text-gray-400">
                  No donations found
                </div>
              )
              : donations.map((donation) => (
                <div key={donation.id} className="px-5 py-3 flex items-center gap-3 hover:bg-[#FFFAF5] transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {donation.donorName ?? donation.profile?.fullName ?? 'Anonymous'}
                    </p>
                    <p className="text-xs font-semibold text-[#D4A843] mt-0.5">{formatINR(donation.amount)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <DonationTypeBadge type={donation.type} />
                      <PaymentStatusBadge status={donation.paymentStatus} />
                    </div>
                    <span className="text-[11px] text-gray-400">{formatDate(donation.createdAt)}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

      </div>
    </div>
  );
}
