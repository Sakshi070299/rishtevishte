'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ImagePlus,
  Trash2,
  ImageOff,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Plus,
  Link as LinkIcon,
  Hash,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Banner {
  id: string;
  title: string;
  titleHi?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
  sortOrder: number;
}

interface BannerForm {
  title: string;
  titleHi: string;
  imageUrl: string;
  linkUrl: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Banner card ───────────────────────────────────────────────────────────────

interface BannerCardProps {
  banner: Banner;
  onDelete: (banner: Banner) => void;
  deleting: boolean;
}

function BannerCard({ banner, onDelete, deleting }: BannerCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="rounded-xl border overflow-hidden shadow-sm group relative flex flex-col"
      style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
    >
      {/* Image preview */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '16/7', backgroundColor: '#F5EDE4' }}
      >
        {imgError ? (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-2"
            style={{ color: '#6B3A1F' }}
          >
            <ImageOff size={28} style={{ opacity: 0.4 }} />
            <span className="text-xs" style={{ opacity: 0.6 }}>
              Image unavailable
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner.imageUrl}
            alt={banner.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        )}

        {/* Hover overlay with open-in-new-tab link */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
          <a
            href={banner.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
            title="Open image in new tab"
          >
            <ExternalLink size={16} style={{ color: '#3D1F0B' }} />
          </a>
        </div>

        {/* Sort order badge */}
        <div
          className="absolute top-2 left-2 text-xs font-bold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
        >
          #{banner.sortOrder}
        </div>

        {/* Link indicator badge */}
        {banner.linkUrl && (
          <div
            className="absolute top-2 right-2 text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-1"
            style={{ backgroundColor: 'rgba(212,168,67,0.9)', color: '#3D1F0B' }}
          >
            <LinkIcon size={10} />
            Linked
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 flex items-start justify-between gap-2 flex-1">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate" style={{ color: '#3D1F0B' }}>
            {banner.title}
          </p>
          {banner.titleHi && (
            <p
              className="text-xs mt-0.5 truncate font-hindi"
              style={{ color: '#6B3A1F' }}
            >
              {banner.titleHi}
            </p>
          )}
          {banner.linkUrl && (
            <a
              href={banner.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs mt-1 truncate hover:underline"
              style={{ color: '#8B1A1A' }}
              title={banner.linkUrl}
            >
              <LinkIcon size={10} />
              <span className="truncate">{banner.linkUrl}</span>
            </a>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={() => onDelete(banner)}
          disabled={deleting}
          aria-label={`Delete banner: ${banner.title}`}
          className="flex-shrink-0 p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ color: '#ef4444' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          {deleting ? (
            <div
              className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#ef4444', borderTopColor: 'transparent' }}
            />
          ) : (
            <Trash2 size={15} />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BannerForm>({
    title: '',
    titleHi: '',
    imageUrl: '',
    linkUrl: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<BannerForm>>({});
  const [bannerPendingDelete, setBannerPendingDelete] = useState<Banner | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  async function fetchBanners() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listBanners() as Banner[];
      setBanners(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBanners();
  }, []);

  // ── Validation ───────────────────────────────────────────────────────────

  function validate(): boolean {
    const errors: Partial<BannerForm> = {};

    if (!form.title.trim()) {
      errors.title = 'Banner title is required';
    }
    if (!form.imageUrl.trim()) {
      errors.imageUrl = 'Image URL is required';
    } else if (!isValidUrl(form.imageUrl.trim())) {
      errors.imageUrl = 'Enter a valid http/https URL';
    }
    if (form.linkUrl.trim() && !isValidUrl(form.linkUrl.trim())) {
      errors.linkUrl = 'Enter a valid http/https URL or leave blank';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Add banner ────────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!validate()) return;

    setAdding(true);
    try {
      await adminApi.addBanner({
        title: form.title.trim(),
        titleHi: form.titleHi.trim() || undefined,
        imageUrl: form.imageUrl.trim(),
        linkUrl: form.linkUrl.trim() || undefined,
      });
      toast.success(`Banner "${form.title.trim()}" added`);
      setForm({ title: '', titleHi: '', imageUrl: '', linkUrl: '' });
      setFormErrors({});
      setShowForm(false);
      await fetchBanners();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add banner';
      toast.error(message);
    } finally {
      setAdding(false);
    }
  }

  // ── Delete banner ─────────────────────────────────────────────────────────

  const requestDelete = useCallback((banner: Banner) => {
    setBannerPendingDelete(banner);
  }, []);

  const cancelDelete = useCallback(() => {
    setBannerPendingDelete(null);
  }, []);

  async function confirmDelete() {
    const banner = bannerPendingDelete;
    if (!banner) return;

    setBannerPendingDelete(null);
    setDeletingId(banner.id);
    try {
      await adminApi.deleteBanner(banner.id);
      toast.success(`Banner "${banner.title}" deleted`);
      await fetchBanners();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete banner';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (!bannerPendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bannerPendingDelete, cancelDelete]);

  // ── Field helper ──────────────────────────────────────────────────────────

  function setField(key: keyof BannerForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: '' }));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#8B1A1A' }}>
            Banner Management
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B3A1F' }}>
            Manage homepage banners displayed to visitors.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm((prev) => !prev);
            if (showForm) {
              setForm({ title: '', titleHi: '', imageUrl: '', linkUrl: '' });
              setFormErrors({});
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200"
          style={{ backgroundColor: '#8B1A1A', color: '#fff' }}
        >
          <Plus size={16} />
          {showForm ? 'Cancel' : 'Add Banner'}
        </button>
      </div>

      {/* Summary strip */}
      <div
        className="flex items-center gap-4 rounded-xl p-4 border"
        style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'rgba(139,26,26,0.08)' }}
        >
          <ImagePlus size={20} style={{ color: '#8B1A1A' }} />
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: '#8B1A1A' }}>
            {loading ? '—' : banners.length > 0 ? banners.length : ''}
          </p>
          <p className="text-xs" style={{ color: '#6B3A1F' }}>
            Active Banners
          </p>
        </div>
        {!loading && banners.length > 0 && (
          <div
            className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ backgroundColor: 'rgba(212,168,67,0.15)', color: '#8B4A00' }}
          >
            <Hash size={11} />
            Sorted by order
          </div>
        )}
      </div>

      {/* Add banner form */}
      {showForm && (
        <div
          className="rounded-xl border p-5 shadow-sm"
          style={{ backgroundColor: '#fff', borderColor: '#D4A843', borderWidth: 1.5 }}
        >
          <h2 className="font-bold mb-4" style={{ color: '#3D1F0B' }}>
            New Banner
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {/* Title (English) */}
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: '#6B3A1F' }}
              >
                Title (English) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Vivah Mahotsav 2026"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                className={`input-field${formErrors.title ? ' input-error' : ''}`}
                disabled={adding}
              />
              {formErrors.title && (
                <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>
              )}
            </div>

            {/* Title (Hindi) — optional */}
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: '#6B3A1F' }}
              >
                Title (Hindi)
                <span className="ml-1 text-xs font-normal" style={{ color: '#9B7A6A' }}>
                  optional
                </span>
              </label>
              <input
                type="text"
                placeholder="e.g. विवाह महोत्सव २०२६"
                value={form.titleHi}
                onChange={(e) => setField('titleHi', e.target.value)}
                className="input-field font-hindi"
                disabled={adding}
              />
            </div>
          </div>

          {/* Image URL */}
          <div className="mb-4">
            <label
              className="block text-xs font-medium mb-1"
              style={{ color: '#6B3A1F' }}
            >
              Image URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              placeholder="https://example.com/banner.jpg"
              value={form.imageUrl}
              onChange={(e) => setField('imageUrl', e.target.value)}
              className={`input-field${formErrors.imageUrl ? ' input-error' : ''}`}
              disabled={adding}
            />
            {formErrors.imageUrl && (
              <p className="text-xs text-red-500 mt-1">{formErrors.imageUrl}</p>
            )}
          </div>

          {/* Link URL — optional */}
          <div className="mb-5">
            <label
              className="block text-xs font-medium mb-1"
              style={{ color: '#6B3A1F' }}
            >
              Link URL
              <span className="ml-1 text-xs font-normal" style={{ color: '#9B7A6A' }}>
                optional — where clicking the banner navigates
              </span>
            </label>
            <input
              type="url"
              placeholder="https://example.com/event"
              value={form.linkUrl}
              onChange={(e) => setField('linkUrl', e.target.value)}
              className={`input-field${formErrors.linkUrl ? ' input-error' : ''}`}
              disabled={adding}
            />
            {formErrors.linkUrl && (
              <p className="text-xs text-red-500 mt-1">{formErrors.linkUrl}</p>
            )}
          </div>

          {/* Live image preview */}
          {isValidUrl(form.imageUrl) && (
            <div className="mb-5">
              <p className="text-xs font-medium mb-1.5" style={{ color: '#6B3A1F' }}>
                Image Preview
              </p>
              <div
                className="rounded-lg overflow-hidden border"
                style={{ maxWidth: 380, borderColor: '#E8D5C4' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.imageUrl}
                  alt="Banner preview"
                  className="w-full object-cover"
                  style={{ maxHeight: 160 }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleAdd}
              disabled={adding}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#8B1A1A', color: '#fff' }}
            >
              {adding ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Adding…
                </>
              ) : (
                <>
                  <ImagePlus size={14} /> Add Banner
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm({ title: '', titleHi: '', imageUrl: '', linkUrl: '' });
                setFormErrors({});
              }}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm border transition-colors"
              style={{ borderColor: '#E8D5C4', color: '#6B3A1F' }}
              disabled={adding}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: '#6B3A1F' }}>
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#8B1A1A', borderTopColor: 'transparent' }}
          />
          <p className="text-sm">Loading banners…</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          className="rounded-xl border p-6 text-center"
          style={{
            backgroundColor: 'rgba(239,68,68,0.05)',
            borderColor: 'rgba(239,68,68,0.2)',
          }}
        >
          <AlertCircle size={28} className="text-red-500 mx-auto mb-2" />
          <p className="font-semibold text-red-600 mb-1">Failed to load banners</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchBanners}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: '#8B1A1A', color: '#fff' }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && banners.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: '#6B3A1F' }}>
          <ImagePlus size={36} style={{ opacity: 0.35 }} />
          <p className="font-semibold">No banners yet</p>
          <p className="text-sm" style={{ opacity: 0.7 }}>
            Click "Add Banner" above to create your first homepage banner.
          </p>
        </div>
      )}

      {/* Banner grid */}
      {!loading && !error && banners.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: '#6B3A1F' }}>
              {banners.length} {banners.length === 1 ? 'banner' : 'banners'} configured
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {banners.map((banner) => (
              <BannerCard
                key={banner.id}
                banner={banner}
                onDelete={requestDelete}
                deleting={deletingId === banner.id}
              />
            ))}
          </div>
        </>
      )}

      {/* Delete confirmation */}
      {bannerPendingDelete && (
        <div
          className="fixed inset-0 z-[100] top-[-25px] flex items-center justify-center "
          role="dialog"
          aria-modal="true"
          aria-labelledby="banner-delete-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            aria-label="Close dialog"
            onClick={cancelDelete}
          />
          <div
            className="relative w-full max-w-md rounded-2xl border shadow-xl p-6"
            style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
          >
            <div className="flex gap-3 mb-4">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}
              >
                <AlertTriangle className="text-red-600" size={22} />
              </div>
              <div className="min-w-0">
                <h2
                  id="banner-delete-title"
                  className="font-bold text-lg leading-tight"
                  style={{ color: '#3D1F0B' }}
                >
                  Delete banner?
                </h2>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#6B3A1F' }}>
                  <span className="font-semibold" style={{ color: '#8B1A1A' }}>
                    {bannerPendingDelete.title}
                  </span>{' '}
                  will be removed from the homepage. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end sm:gap-3 pt-2">
              <button
                type="button"
                onClick={cancelDelete}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm border transition-colors"
                style={{ borderColor: '#E8D5C4', color: '#6B3A1F' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-colors"
                style={{ backgroundColor: '#dc2626' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#dc2626';
                }}
              >
                Delete banner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
