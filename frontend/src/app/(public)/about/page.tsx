import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Temple - Mandir",
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const BLOCKS = [
  {
    icon: "🛕",
    title: "Temple History",
    hi: "मंदिर का इतिहास",
    text: "Mandir is one of the most revered temples in Geeta Colony, East Delhi. The temple gained nationwide attention with its magnificent 51-foot tall Hanuman Ji idol inaugurated on January 22, 2024 — the historic day of Ram Mandir Pran Pratishtha in Ayodhya.",
  },
  {
    icon: "🙏",
    title: "Significance of Hanuman Ji",
    hi: "हनुमान जी का महत्व",
    text: "Lord Hanuman is revered as the embodiment of devotion, strength, courage, and selfless service. Known as Sankat Mochan — the remover of difficulties — Hanuman Ji blesses devotees with fearlessness and spiritual strength.",
  },
  {
    icon: "👥",
    title: "Temple Committee",
    hi: "मंदिर समिति",
    text: "Managed by Geeta Colony Dharmik Ramlila Committee, a dedicated group of community volunteers maintaining the temple, organizing Ramleela, and facilitating community services including matrimony.",
  },
  {
    icon: "🤝",
    title: "Community Services",
    hi: "सामुदायिक सेवाएं",
    text: "Regular Bhandara on Purnima, educational support, health camps, trusted matrimony services, and major festivals like 9-day Ramleela, Hanuman Jayanti, Ram Navami, and weekly Satsang.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section
        className="bg-gradient-to-br from-[#8B1A1A] via-[#5a0f0f] to-[#3D1F0B] text-white text-center py-16 px-6 relative overflow-hidden"
        aria-label="Page hero"
      >
        {/* Subtle radial accent */}
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,160,23,0.15),transparent_60%)] pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-2xl mx-auto">
          {/* Om symbol */}
          <Link href={"/"}>
            <Image
              className="size-12 mx-auto"
              src={"/icons/om-icon-v2.png"}
              width={40}
              height={40}
              alt="om-logo"
            />
          </Link>
          {/* Hindi heading */}
          <p className="font-hindi text-[#F5E6B8] text-2xl md:text-3xl mb-2 mt-3">
            मंदिर के बारे में
          </p>

          {/* English heading */}
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
            About the Temple
          </h1>

          {/* Subtitle */}
          <p className="text-white/70 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Discover the history, significance, and community spirit of{" "}
            <span className="text-[#F5E6B8] font-medium">
              Mandir
            </span>
            , Geeta Colony, East Delhi.
          </p>
        </div>
      </section>

      {/* ── Content Blocks ────────────────────────────────────────────── */}
      <section
        className="max-w-4xl mx-auto px-4 sm:px-6 py-14"
        aria-label="Temple information"
      >
        <div className="space-y-6">
          {BLOCKS.map((block) => (
            <article
              key={block.title}
              className="flex gap-5 bg-white border border-[#E8D5C4] rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
              {/* Icon column */}
              <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-xl bg-[#FFFAF5] border border-[#F5E6B8] text-3xl select-none">
                {block.icon}
              </div>

              {/* Text column */}
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[#8B1A1A] leading-snug">
                  {block.title}
                </h2>
                <p className="font-hindi text-[#D4A017] text-sm mt-0.5 mb-3">
                  {block.hi}
                </p>
                <p className="text-[#3D1F0B]/80 text-sm sm:text-base leading-relaxed">
                  {block.text}
                </p>
              </div>
            </article>
          ))}
        </div>

        {/* ── CTA strip ─────────────────────────────────────────────── */}
        <div className="mt-12 rounded-2xl bg-gradient-to-r from-[#8B1A1A] to-[#5a0f0f] text-white px-8 py-10 text-center shadow-lg">
          <p className="font-hindi text-[#F5E6B8] text-xl mb-2">
            रिश्तेसेतु में पंजीकरण करें
          </p>
          <h3 className="text-2xl font-bold mb-3">
            Register for Temple Matrimony
          </h3>
          <p className="text-white/70 text-sm mb-6 max-w-md mx-auto">
            With the blessings of Hanuman Ji, find your life partner through our
            trusted temple community platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="bg-[#D4A017] hover:bg-yellow-500 text-[#3D1F0B] font-bold px-7 py-3 rounded-xl transition-all duration-200 hover:-translate-y-0.5 shadow-md shadow-black/20 text-sm"
            >
              Register Now — विवाह पंजीकरण
            </Link>
            <Link
              href="/contact"
              className="border border-white/40 hover:bg-white/10 text-white font-semibold px-7 py-3 rounded-xl transition-all duration-200 text-sm"
            >
              Contact Temple
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
