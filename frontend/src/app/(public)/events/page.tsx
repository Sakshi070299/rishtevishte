import type { Metadata } from "next";
import Link from "next/link";
import { Calendar } from "lucide-react";
import Image from "next/image";

export const metadata: Metadata = {
  title: `Events - TheMarriageHome.com`,
};

// ─── Data ─────────────────────────────────────────────────────────────────────

interface EventItem {
  name: string;
  hi: string;
  date: string;
  desc: string;
}

const EVENTS: EventItem[] = [
  {
    name: "Hanuman Jayanti",
    hi: "हनुमान जयंती",
    date: "April 2026",
    desc: "Grand celebration with special abhishek, kirtan, and prasad distribution.",
  },
  {
    name: "Ram Navami",
    hi: "राम नवमी",
    date: "April 2026",
    desc: "Celebration of Lord Rama's birth with day-long devotional programs.",
  },
  {
    name: "Weekly Satsang",
    hi: "साप्ताहिक सत्संग",
    date: "Every Tuesday",
    desc: "Evening devotional gathering with bhajans, katha, and spiritual discourse.",
  },
  {
    name: "Monthly Bhandara",
    hi: "मासिक भंडारा",
    date: "Every Purnima",
    desc: "Free community meal served to all on every full moon day.",
  },
  {
    name: "Ramleela",
    hi: "रामलीला",
    date: "October 2026",
    desc: "9-day grand Ramleela during Navratri at Ramleela Ground.",
  },
  {
    name: "Sundarkand Path",
    hi: "सुंदरकांड पाठ",
    date: "Every Saturday",
    desc: "Collective recitation of Sundarkand followed by aarti and prasad.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a badge color variant based on date string.
 * Recurring events get the gold variant; dated events get maroon.
 */
function isRecurring(date: string): boolean {
  return date.toLowerCase().startsWith("every");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventsPage() {
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
          <Link href={"/"}>
            <Image
              className="size-12 mx-auto"
              src="/icons/marriagehome-logo.png"
              width={40}
              height={40}
              alt="om-logo"
            />
          </Link>
          <p className="font-hindi text-[#F5E6B8] text-2xl md:text-3xl mb-2 mt-3">
            कार्यक्रम
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
            Temple Events
          </h1>
          <p className="text-white/70 text-base max-w-lg mx-auto leading-relaxed">
            Join us for gatherings, celebrations, and community
            events organized by TheMarriageHome.com throughout the year.
          </p>
        </div>
      </section>

      {/* ── Events List ───────────────────────────────────────────────── */}
      <section
        className="max-w-[720px] mx-auto px-4 sm:px-6 py-14"
        aria-label="Upcoming events"
      >
        {/* Section label */}
        <div className="flex items-center gap-3 mb-8">
          <span className="flex-1 h-px bg-[#E8D5C4]" aria-hidden="true" />
          <p className="text-[#8B1A1A] font-semibold text-sm uppercase tracking-widest whitespace-nowrap">
            Upcoming &amp; Regular Events
          </p>
          <span className="flex-1 h-px bg-[#E8D5C4]" aria-hidden="true" />
        </div>

        <ol className="space-y-4" aria-label="Event list">
          {EVENTS.map((event) => {
            const recurring = isRecurring(event.date);
            return (
              <li key={event.name}>
                <article className="flex gap-2.5 sm:gap-4 bg-white border border-[#E8D5C4] rounded-2xl p-3 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  {/* Date badge column */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-2 pt-0.5">
                    {/* Icon */}
                    <span
                      className={[
                        "size-8 sm:size-10 rounded-xl flex items-center justify-center shadow-sm",
                        recurring
                          ? "bg-[#F5E6B8] text-[#D4A017]"
                          : "bg-[#8B1A1A]/10 text-[#8B1A1A]",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      <Calendar size={18} strokeWidth={2} />
                    </span>

                    {/* Date text */}
                    <span
                      className={[
                        "text-[10px] font-bold text-center leading-tight px-2 py-1 rounded-lg  whitespace-nowrap",
                        recurring
                          ? "bg-[#F5E6B8] text-[#3D1F0B]"
                          : "bg-[#8B1A1A]/10 text-[#8B1A1A]",
                      ].join(" ")}
                    >
                      {event.date}
                    </span>
                  </div>

                  {/* Content column */}
                  <div className="min-w-0">
                    <h2 className="text-[#8B1A1A] font-bold    sm:text-base text-sm leading-snug">
                      {event.name}
                    </h2>
                    <p className="font-hindi text-[#D4A017] sm:text-sm text-xs mt-0.5 mb-2">
                      {event.hi}
                    </p>
                    <p className="text-[#3D1F0B]/70 sm:text-sm text-xs leading-relaxed">
                      {event.desc}
                    </p>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>

        {/* ── Bottom note ───────────────────────────────────────────── */}
        <div className="mt-10 bg-[#FFFAF5] border border-[#F5E6B8] rounded-2xl p-6 text-center">
          <p className="font-hindi text-[#8B1A1A] text-lg mb-1">जय श्री राम</p>
          <p className="text-[#3D1F0B]/70 text-sm leading-relaxed mb-5">
            All are welcome. For event updates and announcements, contact the
            temple office or follow our community board.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact"
              className="bg-[#8B1A1A] hover:bg-[#5a0f0f] text-white font-semibold px-6 py-2.5 rounded-xl transition-all duration-200 text-sm inline-flex items-center gap-2 hover:-translate-y-0.5 shadow-sm"
            >
              <Calendar size={16} aria-hidden="true" />
              Contact Temple
            </Link>
            <Link
              href="/donation"
              className="border border-[#D4A017] text-[#3D1F0B] hover:bg-[#F5E6B8] font-semibold px-6 py-2.5 rounded-xl transition-all duration-200 text-sm inline-flex items-center gap-2"
            >
              Support an Event
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
