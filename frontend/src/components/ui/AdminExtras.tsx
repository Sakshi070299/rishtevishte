// ═══════════════════════════════════════════════════════
// FEATURE 10: Admin Banner Management
// FEATURE 11: Admin Donation History
// Additional admin sub-pages
// ═══════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Image, Upload, Trash2, Eye, DollarSign, Filter,
  Calendar, Download, ChevronDown, Loader2,
} from 'lucide-react';
import { adminApi, api } from '@/lib/api';

// ═══ BANNER MANAGEMENT COMPONENT ════════════════════
export function BannerManager() {
  const [banners, setBanners] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', titleHi: '', position: 'hero' });

  
  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const data = await adminApi.getGallery() as any[];
      setBanners(data.filter((g: any) => g.title.toLowerCase().includes('banner')));
    } catch { /* empty */ }
  };

  const handleUpload = async () => {
    if (!form.title) { toast.error('Enter banner title'); return; }
    setUploading(true);
    try {
      await adminApi.addGalleryImage(
        `Banner: ${form.title}`,
        form.titleHi || form.title,
        '/placeholder-banner.jpg' // Replace with actual upload URL
      );
      toast.success('Banner uploaded!');
      setForm({ title: '', titleHi: '', position: 'hero' });
      loadBanners();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h3 className="font-bold text-[#8B1A1A] mb-4 text-lg">
        Banner Management
        <span className="font-normal text-sm text-[#E8651A] ml-2" style={{ fontFamily: "'Yatra One', serif" }}>
          बैनर प्रबंधन
        </span>
      </h3>

      {/* Upload Form */}
      <div className="bg-white rounded-xl border border-[#E8D5C4] p-5 mb-6 shadow-sm">
        <h4 className="font-semibold text-[#3D1F0B] mb-3 flex items-center gap-2">
          <Upload size={16} className="text-[#E8651A]" /> Upload New Banner
        </h4>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#6B3A1F] mb-1">Banner Title</label>
            <input
              className="w-full px-3 py-2.5 border-[1.5px] border-[#E8D5C4] rounded-lg text-sm"
              placeholder="e.g. Hanuman Jayanti 2026"
              value={form.title}
              onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B3A1F] mb-1">Title (Hindi)</label>
            <input
              className="w-full px-3 py-2.5 border-[1.5px] border-[#E8D5C4] rounded-lg text-sm"
              placeholder="हनुमान जयंती 2026"
              value={form.titleHi}
              onChange={(e) => setForm(p => ({ ...p, titleHi: e.target.value }))}
              style={{ fontFamily: "'Yatra One', serif" }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B3A1F] mb-1">Position</label>
            <select
              className="w-full px-3 py-2.5 border-[1.5px] border-[#E8D5C4] rounded-lg text-sm"
              value={form.position}
              onChange={(e) => setForm(p => ({ ...p, position: e.target.value }))}
            >
              <option value="hero">Hero Banner (Homepage)</option>
              <option value="sidebar">Sidebar Banner</option>
              <option value="popup">Popup Announcement</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handleUpload} disabled={uploading} className="bg-[#E8651A] text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#C44E0A] flex items-center gap-2 transition-all">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Uploading...' : 'Upload Banner'}
            </button>
          </div>
        </div>
        <p className="text-xs text-[#7A6355] mt-3">
          Recommended: 1920x600px for hero, 400x300px for sidebar. JPG/PNG, max 5MB.
        </p>
      </div>

      {/* Current Banners */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {banners.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[#7A6355]">
            <Image size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">No banners uploaded yet</p>
          </div>
        ) : banners.map((b: any) => (
          <div key={b.id} className="bg-white rounded-xl border border-[#E8D5C4] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="h-32 bg-gradient-to-br from-[#8B1A1A] to-[#E8651A] flex items-center justify-center">
              {b.imageUrl ? (
                <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
              ) : (
                <Image size={32} className="text-white/40" />
              )}
            </div>
            <div className="p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-[#3D1F0B]">{b.title}</p>
                <p className="text-xs text-[#7A6355]">{b.titleHi}</p>
              </div>
              <button
                onClick={() => { adminApi.deleteGalleryImage(b.id); setBanners(p => p.filter(x => x.id !== b.id)); toast.success('Deleted'); }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ DONATION HISTORY COMPONENT ═════════════════════
export function DonationHistory() {
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', period: 'monthly' });
  const [totals, setTotals] = useState({ registration: 0, general: 0, total: 0, count: 0 });

  useEffect(() => {
    loadDonations();
  }, [filter]);

  const loadDonations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.type) params.set('type', filter.type);
      params.set('limit', '50');

      const data = await api(`/donations?${params.toString()}`) as any;
      setDonations(data.data || []);

      // Calculate totals
      const completed = (data.data || []).filter((d: any) => d.paymentStatus === 'COMPLETED');
      const regTotal = completed.filter((d: any) => d.type === 'REGISTRATION').reduce((s: number, d: any) => s + d.amount, 0);
      const genTotal = completed.filter((d: any) => d.type === 'GENERAL').reduce((s: number, d: any) => s + d.amount, 0);
      setTotals({
        registration: regTotal / 100,
        general: genTotal / 100,
        total: (regTotal + genTotal) / 100,
        count: completed.length,
      });
    } catch { /* empty */ }
    setLoading(false);
  };

  return (
    <div>
      <h3 className="font-bold text-[#8B1A1A] mb-4 text-lg">
        Donation History
        <span className="font-normal text-sm text-[#E8651A] ml-2" style={{ fontFamily: "'Yatra One', serif" }}>
          दान इतिहास
        </span>
      </h3>

      {/* Totals */}
      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Donations', val: `₹${totals.total.toLocaleString('en-IN')}`, color: '#D4A017', bg: '#FFF8E1' },
          { label: 'Registration', val: `₹${totals.registration.toLocaleString('en-IN')}`, color: '#E8651A', bg: '#FFF3EB' },
          { label: 'General', val: `₹${totals.general.toLocaleString('en-IN')}`, color: '#16a34a', bg: '#dcfce7' },
          { label: 'Total Count', val: totals.count.toString(), color: '#2563eb', bg: '#dbeafe' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#E8D5C4] p-4 text-center shadow-sm">
            <p className="text-2xl font-extrabold" style={{ color: s.color }}>{s.val}</p>
            <p className="text-xs font-medium text-[#3D1F0B] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#E8D5C4] p-4 mb-4 flex gap-3 flex-wrap items-center shadow-sm">
        <Filter size={16} className="text-[#E8651A]" />
        <select
          className="px-3 py-2 border border-[#E8D5C4] rounded-lg text-sm"
          value={filter.type}
          onChange={(e) => setFilter(p => ({ ...p, type: e.target.value }))}
        >
          <option value="">All Donations</option>
          <option value="REGISTRATION">Registration Only</option>
          <option value="GENERAL">General Only</option>
        </select>
        <button onClick={loadDonations} className="text-sm text-[#E8651A] hover:underline">Refresh</button>
        <button className="ml-auto text-sm bg-[#16a34a]/10 text-[#16a34a] px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 hover:bg-[#16a34a]/20">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="animate-spin text-[#E8651A] mx-auto" size={24} /></div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E8D5C4] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FFF0E0]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[#3D1F0B] text-xs">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#3D1F0B] text-xs">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#3D1F0B] text-xs">Donor</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#3D1F0B] text-xs">Profile</th>
                  <th className="px-4 py-3 text-right font-semibold text-[#3D1F0B] text-xs">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#3D1F0B] text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {donations.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[#7A6355]">No donations found</td></tr>
                ) : donations.map((d: any) => (
                  <tr key={d.id} className="border-t border-[#E8D5C4] hover:bg-[#FFFAF5]/50">
                    <td className="px-4 py-3 text-xs text-[#7A6355]">{new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        d.type === 'REGISTRATION' ? 'bg-[#FFF3EB] text-[#E8651A]' : 'bg-[#dcfce7] text-[#16a34a]'
                      }`}>{d.type}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{d.donorName || d.donorMobile || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono">{d.profile?.registrationNumber || '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#3D1F0B]">₹{(d.amount / 100).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        d.paymentStatus === 'COMPLETED' ? 'bg-[#dcfce7] text-[#16a34a]' :
                        d.paymentStatus === 'PENDING' ? 'bg-[#fef9c3] text-[#a16207]' :
                        'bg-[#fee2e2] text-[#dc2626]'
                      }`}>{d.paymentStatus}</span>
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
