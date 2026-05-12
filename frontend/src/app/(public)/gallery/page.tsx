"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, ZoomIn, Loader2 } from "lucide-react";
import { contentApi } from "@/lib/api";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GalleryItem {
  id: string;
  title: string;
  titleHi: string;
  imageUrl: string;
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

interface LightboxProps {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function Lightbox({ items, index, onClose, onPrev, onNext }: LightboxProps) {
  const item = items[index];
  const total = items.length;

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext]);

  // Prevent body scroll while lightbox is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Image lightbox: ${item.title}`}
      onClick={onClose}
    >
      {/* Inner panel — stop propagation so clicks inside don't close */}
      <div
        className="relative flex flex-col items-center max-w-4xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close lightbox"
          className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
        >
          <X size={28} />
        </button>

        {/* Counter */}
        <p className="absolute -top-11 left-0 text-white/60 text-sm font-medium select-none">
          {index + 1} / {total}
        </p>

        {/* Image */}
        <div className="relative w-full rounded-xl overflow-hidden bg-black shadow-2xl shadow-black/60">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full max-h-[70vh] object-contain block"
          />
        </div>

        {/* Caption */}
        <div className="mt-4 text-center">
          <p className="text-white font-semibold text-lg">{item.title}</p>
          <p className="font-hindi text-[#D4A017] text-sm mt-0.5">{item.titleHi}</p>
        </div>

        {/* Prev / Next buttons */}
        <button
          onClick={onPrev}
          aria-label="Previous image"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-3 transition-all duration-200 hover:-translate-x-14 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]"
        >
          <ChevronLeft size={28} />
        </button>
        <button
          onClick={onNext}
          aria-label="Next image"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-3 transition-all duration-200 hover:translate-x-14 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017]"
        >
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const PER_PAGE = 12;

export default function GalleryPage() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(gallery.length / PER_PAGE);
  const paginatedGallery = gallery.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  useEffect(() => {
    contentApi.gallery()
      .then((data) => setGallery(data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const openLightbox = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const goToPrev = useCallback(() => {
    setActiveIndex((prev) =>
      prev === null ? null : (prev - 1 + paginatedGallery.length) % paginatedGallery.length,
    );
  }, [paginatedGallery.length]);

  const goToNext = useCallback(() => {
    setActiveIndex((prev) =>
      prev === null ? null : (prev + 1) % paginatedGallery.length,
    );
  }, [paginatedGallery.length]);

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section
        className="bg-gradient-to-br from-[#8B1A1A] via-[#5a0f0f] to-[#3D1F0B] text-white text-center py-16 px-6 relative overflow-hidden"
        aria-label="Page hero"
      >
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,160,23,0.15),transparent_60%)] pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative z-10 max-w-2xl mx-auto">
          <Link href={"/"} >
            <Image
              className="size-12 mx-auto"
              src="/icons/marriagehome-logo.png"
              width={40}
              height={40}
              alt="om-logo"
            />
          </Link>
          <p className="font-hindi text-[#F5E6B8] text-2xl md:text-3xl mb-2 mt-3">
            फोटो गैलरी
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
            Temple Gallery
          </h1>
          <p className="text-white/70 text-base max-w-lg mx-auto leading-relaxed">
            A glimpse into our vibrant community events and
            memorable celebrations.
          </p>
        </div>
      </section>

      {/* ── Gallery Grid ──────────────────────────────────────────────── */}
      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 py-14"
        aria-label="Photo gallery"
      >
        <div className="text-center mb-10">
          <p className="text-[#3D1F0B]/50 text-sm">
            Click any photo to view full size
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-[#8B1A1A]" />
          </div>
        ) : gallery.length === 0 ? (
          <p className="text-center text-[#3D1F0B]/50 py-20">No images in gallery yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {paginatedGallery.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => openLightbox(index)}
                  aria-label={`View ${item.title} — ${item.titleHi}`}
                  className="group relative rounded-2xl overflow-hidden aspect-[4/3] bg-[#3D1F0B]/10 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A017] focus-visible:ring-offset-2"
                >
                  {/* Photo */}
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-end p-4">
                    <ZoomIn
                      size={28}
                      className="text-white mb-2 drop-shadow-lg"
                      aria-hidden="true"
                    />
                    <p className="text-white font-semibold text-sm leading-snug drop-shadow">
                      {item.title}
                    </p>
                    <p className="font-hindi text-[#F5E6B8] text-xs mt-0.5 drop-shadow">
                      {item.titleHi}
                    </p>
                  </div>

                  {/* Always-visible bottom strip (subtle) */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent py-3 px-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <span className="sr-only">{item.title}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-6 pt-10">
                <button
                  onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ color: '#8B1A1A', borderColor: '#8B1A1A' }}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <span className="text-sm font-medium" style={{ color: '#3D1F0B' }}>
                  Page <span className="font-bold" style={{ color: '#8B1A1A' }}>{currentPage}</span> of <span className="font-bold" style={{ color: '#8B1A1A' }}>{totalPages}</span>
                </span>
                <button
                  onClick={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ color: '#8B1A1A', borderColor: '#8B1A1A' }}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Lightbox ──────────────────────────────────────────────────── */}
      {activeIndex !== null && (
        <Lightbox
          items={paginatedGallery}
          index={activeIndex}
          onClose={closeLightbox}
          onPrev={goToPrev}
          onNext={goToNext}
        />
      )}
    </>
  );
}
