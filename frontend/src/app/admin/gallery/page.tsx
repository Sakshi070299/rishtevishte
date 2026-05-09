'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  ImageOff,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  AlertTriangle,ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GalleryImage {
  id: string;
  title: string;
  titleHi: string;
  imageUrl: string;
  sortOrder: number;
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

// ─── Image card ────────────────────────────────────────────────────────────────

interface GalleryCardProps {
  image: GalleryImage;
  onDelete: (image: GalleryImage) => void;
  deleting: boolean;
}

function GalleryCard({ image, onDelete, deleting }: GalleryCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="rounded-xl border overflow-hidden shadow-sm group relative"
      style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
    >
      {/* Image preview */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '4/3', backgroundColor: '#F5EDE4' }}
      >
        {imgError ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: '#6B3A1F' }}>
            <ImageOff size={28} style={{ opacity: 0.4 }} />
            <span className="text-xs" style={{ opacity: 0.6 }}>
              Image unavailable
            </span>
          </div>
        ) : (
          // Using a standard img tag — Next/Image requires domain config for dynamic URLs
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.imageUrl}
            alt={image.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
          <a
            href={image.imageUrl}
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
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff' }}
        >
          #{image.sortOrder}
        </div>
      </div>

      {/* Card body */}
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: '#3D1F0B' }}>
            {image.title}
          </p>
          {image.titleHi && (
            <p
              className="text-xs mt-0.5 truncate font-hindi"
              style={{ color: '#6B3A1F' }}
            >
              {image.titleHi}
            </p>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={() => onDelete(image)}
          disabled={deleting}
          aria-label={`Delete ${image.title}`}
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

export default function GalleryPage() {
  const PER_PAGE = 12;
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', titleHi: '', imageUrl: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [imagePendingDelete, setImagePendingDelete] = useState<GalleryImage | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(images.length / PER_PAGE);
  const paginatedImages = images.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  // ── Fetch ────────────────────────────────────────────────────────────────

  async function fetchGallery() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getGallery() as GalleryImage[];
      setImages(data);
      setCurrentPage((prev) => Math.min(prev, Math.ceil(data.length / PER_PAGE) || 1));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load gallery images');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGallery();
  }, []);

  // ── Validate form ────────────────────────────────────────────────────────

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = 'English title is required';
    if (!form.titleHi.trim()) errors.titleHi = 'Hindi title is required';
    if (!form.imageUrl.trim()) {
      errors.imageUrl = 'Image URL is required';
    } else if (!isValidUrl(form.imageUrl.trim())) {
      errors.imageUrl = 'Enter a valid http/https URL';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Add image ────────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!validate()) return;

    setAdding(true);
    try {
      await adminApi.addGalleryImage(
        form.title.trim(),
        form.titleHi.trim(),
        form.imageUrl.trim()
      );
      toast.success(`"${form.title.trim()}" added to gallery`);
      setForm({ title: '', titleHi: '', imageUrl: '' });
      setFormErrors({});
      setShowForm(false);
      await fetchGallery();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add image';
      toast.error(message);
    } finally {
      setAdding(false);
    }
  }

  // ── Delete image ─────────────────────────────────────────────────────────

  const requestDelete = useCallback((image: GalleryImage) => {
    setImagePendingDelete(image);
  }, []);

  const cancelDelete = useCallback(() => {
    setImagePendingDelete(null);
  }, []);

  async function confirmDelete() {
    const image = imagePendingDelete;
    if (!image) return;

    setImagePendingDelete(null);
    setDeletingId(image.id);
    try {
      await adminApi.deleteGalleryImage(image.id);
      toast.success(`"${image.title}" deleted`);
      await fetchGallery();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete image';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (!imagePendingDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDelete();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imagePendingDelete, cancelDelete]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#8B1A1A' }}>
            Gallery Management
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B3A1F' }}>
            Add, preview, and remove images displayed in the temple gallery.
          </p>
        </div>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200"
          style={{ backgroundColor: '#8B1A1A', color: '#fff' }}
        >
          <Plus size={16} />
          {showForm ? 'Cancel' : 'Add Image'}
        </button>
      </div>

      {/* Add image form */}
      {showForm && (
        <div
          className="rounded-xl border p-5 shadow-sm"
          style={{ backgroundColor: '#fff', borderColor: '#D4A843', borderWidth: 1.5 }}
        >
          <h2 className="font-bold mb-4" style={{ color: '#3D1F0B' }}>
            New Gallery Image
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {/* English title */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#6B3A1F' }}>
                Title (English) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Temple Entrance"
                value={form.title}
                onChange={(e) => {
                  setForm((p) => ({ ...p, title: e.target.value }));
                  setFormErrors((p) => ({ ...p, title: '' }));
                }}
                className={`input-field ${formErrors.title ? 'input-error' : ''}`}
                disabled={adding}
              />
              {formErrors.title && (
                <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>
              )}
            </div>

            {/* Hindi title */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#6B3A1F' }}>
                Title (Hindi) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. मंदिर प्रवेश"
                value={form.titleHi}
                onChange={(e) => {
                  setForm((p) => ({ ...p, titleHi: e.target.value }));
                  setFormErrors((p) => ({ ...p, titleHi: '' }));
                }}
                className={`input-field font-hindi ${formErrors.titleHi ? 'input-error' : ''}`}
                disabled={adding}
              />
              {formErrors.titleHi && (
                <p className="text-xs text-red-500 mt-1">{formErrors.titleHi}</p>
              )}
            </div>
          </div>

          {/* Image URL */}
          <div className="mb-5">
            <label className="block text-xs font-medium mb-1" style={{ color: '#6B3A1F' }}>
              Image URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={form.imageUrl}
              onChange={(e) => {
                setForm((p) => ({ ...p, imageUrl: e.target.value }));
                setFormErrors((p) => ({ ...p, imageUrl: '' }));
              }}
              className={`input-field ${formErrors.imageUrl ? 'input-error' : ''}`}
              disabled={adding}
            />
            {formErrors.imageUrl && (
              <p className="text-xs text-red-500 mt-1">{formErrors.imageUrl}</p>
            )}
          </div>

          {/* Inline preview */}
          {isValidUrl(form.imageUrl) && (
            <div className="mb-5">
              <p className="text-xs font-medium mb-1.5" style={{ color: '#6B3A1F' }}>
                Preview
              </p>
              <div
                className="rounded-lg overflow-hidden border"
                style={{ maxWidth: 280, borderColor: '#E8D5C4' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.imageUrl}
                  alt="Preview"
                  className="w-full object-cover"
                  style={{ maxHeight: 180 }}
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
                  <Plus size={14} /> Add to Gallery
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm({ title: '', titleHi: '', imageUrl: '' });
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
          <p className="text-sm">Loading gallery…</p>
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
          <p className="font-semibold text-red-600 mb-1">Failed to load gallery</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchGallery}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: '#8B1A1A', color: '#fff' }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && images.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20" style={{ color: '#6B3A1F' }}>
          <ImageOff size={36} style={{ opacity: 0.4 }} />
          <p className="font-semibold">No gallery images yet</p>
          <p className="text-sm" style={{ opacity: 0.7 }}>
            Click "Add Image" above to upload your first gallery image.
          </p>
        </div>
      )}

      {/* Image grid */}
      {!loading && !error && images.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: '#6B3A1F' }}>
              {images.length} {images.length === 1 ? 'image' : 'images'} in gallery
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {paginatedImages.map((img) => (
              <GalleryCard
                key={img.id}
                image={img}
                onDelete={requestDelete}
                deleting={deletingId === img.id}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: '#6B3A1F', borderColor: '#E8D5C4' }}
              >
                <ChevronLeft size={15} />
                Previous
              </button>
              <span className="text-sm font-medium" style={{ color: '#6B3A1F' }}>
                Page <span style={{ color: '#8B1A1A', fontWeight: 700 }}>{currentPage}</span> of <span style={{ color: '#8B1A1A', fontWeight: 700 }}>{totalPages}</span>
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: '#6B3A1F', borderColor: '#E8D5C4' }}
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </>
      )}

      {imagePendingDelete && (
        <div
          className="fixed top-[-25px] inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gallery-delete-title"
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
                  id="gallery-delete-title"
                  className="font-bold text-lg leading-tight"
                  style={{ color: '#3D1F0B' }}
                >
                  Remove from gallery?
                </h2>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#6B3A1F' }}>
                  <span className="font-semibold" style={{ color: '#8B1A1A' }}>
                    {imagePendingDelete.title}
                  </span>{' '}
                  will be removed from the temple gallery. This cannot be undone.
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
                Delete image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
