import type { Metadata } from 'next';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Us - TheMarriageHome.com',
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MAPS_URL =
  'https://maps.google.com/?q=TheMarriageHome+Delhi+India';

const INFO_ITEMS = [
  {
    icon: MapPin,
    label: 'Address',
    content: [
      'TheMarriageHome.com,',
      'New Delhi,',
      'India — 110001',
    ],
  },
  {
    icon: Phone,
    label: 'Phone',
    content: ['+91 8196019883'],
  },
  {
    icon: Mail,
    label: 'Email',
    content: ['admin@themarriagehome.com'],
    href: 'mailto:admin@themarriagehome.com',
  },
  {
    icon: Clock,
    label: 'Support Hours',
    content: [
      'Monday – Saturday: 9:00 AM – 7:00 PM',
      'Sunday: 10:00 AM – 4:00 PM',
    ],
  },
] as const;

const SCHEDULE: [string, string][] = [
  ['9:00 AM', 'Phone support opens'],
  ['10:00 AM', 'Walk-in consultations begin'],
  ['1:00 PM', 'Afternoon break'],
  ['2:00 PM', 'Consultations resume'],
  ['5:00 PM', 'Last walk-in slot'],
  ['7:00 PM', 'Office closes'],
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactPage() {
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
          <img
            src="/icons/marriagehome-logo.png"
            alt="TheMarriageHome.com logo"
            className="mx-auto h-20 w-40 mb-3"
          />
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
            Contact Us
          </h1>
          <p className="text-white/70 text-base max-w-lg mx-auto leading-relaxed">
            Reach out to us — we are here to help you find your perfect life
            partner.
          </p>
        </div>
      </section>

      {/* ── Two-column layout ─────────────────────────────────────────── */}
      <section
        className="max-w-6xl mx-auto px-4 sm:px-6 py-14"
        aria-label="Contact information"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* ── LEFT: Contact Information ──────────────────────────────── */}
          <div>
            <div className="bg-white border border-[#E8D5C4] rounded-2xl shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="bg-gradient-to-r from-[#8B1A1A] to-[#5a0f0f] px-6 py-4">
                <h2 className="text-white font-bold text-lg">
                  Contact Information
                </h2>
                <p className="text-[#F5E6B8] text-sm mt-0.5">
                  Get in touch with our team
                </p>
              </div>

              {/* Info items */}
              <ul className="divide-y divide-[#F5E6B8]">
                {INFO_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.label} className="flex gap-4 px-6 py-5">
                      {/* Icon */}
                      <span
                        className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#F5E6B8] flex items-center justify-center mt-0.5"
                        aria-hidden="true"
                      >
                        <Icon
                          size={18}
                          strokeWidth={2}
                          className="text-[#D4A017]"
                        />
                      </span>

                      {/* Content */}
                      <div className="min-w-0">
                        <p className="font-semibold text-[#8B1A1A] text-sm">
                          {item.label}
                        </p>
                        {item.label === 'Phone' ? (
                          <div className="space-y-1">
                            {item.content.map((line) => (
                              <a
                                key={line}
                                href={`tel:+91${line.replace(/\\D/g, '')}`}
                                className="block text-[#3D1F0B]/80 text-sm leading-relaxed hover:text-[#8B1A1A] transition-colors duration-200 break-all"
                              >
                                +91 {line}
                              </a>
                            ))}
                          </div>
                        ) : 'href' in item && item.href ? (
                          <a
                            href={item.href}
                            className="text-[#3D1F0B]/80 text-sm leading-relaxed hover:text-[#8B1A1A] transition-colors duration-200 break-all"
                          >
                            {item.content[0]}
                          </a>
                        ) : 'content' in item ? (
                          <address className="not-italic">
                            {item.content.map((line) => (
                              <span
                                key={line}
                                className="block text-[#3D1F0B]/80 text-sm leading-relaxed"
                              >
                                {line}
                              </span>
                            ))}
                          </address>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* ── RIGHT: Map + Schedule ──────────────────────────────────── */}
          <div className="space-y-6">
            {/* Google Maps placeholder */}
            <div className="bg-white border border-[#E8D5C4] rounded-2xl shadow-sm overflow-hidden">
              {/* Map visual placeholder */}
              <div className="h-52 bg-gradient-to-br from-[#FFFAF5] to-[#F5E6B8] flex flex-col items-center justify-center gap-3 relative">
                {/* Decorative grid lines */}
                <div
                  className="absolute inset-0 opacity-20"
                  aria-hidden="true"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(0deg,#D4A017 0,#D4A017 1px,transparent 1px,transparent 40px), repeating-linear-gradient(90deg,#D4A017 0,#D4A017 1px,transparent 1px,transparent 40px)',
                  }}
                />

                {/* Pin icon */}
                <div className="relative z-10 w-14 h-14 rounded-full bg-[#8B1A1A] flex items-center justify-center shadow-lg shadow-[#8B1A1A]/40">
                  <MapPin size={26} className="text-white" aria-hidden="true" />
                </div>

                <div className="relative z-10 text-center">
                  <p className="font-bold text-[#8B1A1A] text-base">
                    Google Map
                  </p>
                  <p className="text-[#3D1F0B]/60 text-sm mt-0.5">
                    View our location
                  </p>
                </div>
              </div>

              {/* Card footer */}
              <div className="px-5 py-4 border-t border-[#F5E6B8] flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[#3D1F0B]/60 text-xs leading-relaxed max-w-[220px]">
                  TheMarriageHome.com, New Delhi, India — 110001
                </p>
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 inline-flex items-center gap-1.5 bg-[#8B1A1A] hover:bg-[#5a0f0f] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 shadow-sm shadow-[#8B1A1A]/30"
                  aria-label="Open office location in Google Maps (opens in new tab)"
                >
                  Open in Google Maps
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>

            {/* Office Hours card */}
            <div className="bg-white border border-[#E8D5C4] rounded-2xl shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="bg-gradient-to-r from-[#D4A017] to-[#b8860b] px-6 py-4">
                <h2 className="text-[#3D1F0B] font-bold text-lg">
                  Office Hours
                </h2>
                <p className="text-[#3D1F0B]/70 text-sm mt-0.5">
                  Walk-in &amp; phone support schedule
                </p>
              </div>

              {/* Schedule table */}
              <table className="w-full" aria-label="Office hours schedule">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5E6B8]">
                  {SCHEDULE.map(([time, activity]) => {
                    const isHighlight =
                      activity.toLowerCase().includes('consultation');
                    const isBreak =
                      activity.toLowerCase().includes('break') ||
                      activity.toLowerCase().includes('closes');

                    return (
                      <tr
                        key={time}
                        className={[
                          'transition-colors',
                          isHighlight
                            ? 'bg-[#FFFAF5]'
                            : isBreak
                              ? 'bg-[#f9f9f9]'
                              : '',
                        ].join(' ')}
                      >
                        {/* Time cell */}
                        <td className="pl-6 pr-4 py-3.5  align-top">
                          <span
                            className={[
                              'inline-block text-xs font-bold px-2 py-1 rounded-lg',
                              isHighlight
                                ? 'bg-[#F5E6B8] text-[#8B1A1A]'
                                : isBreak
                                  ? 'bg-[#f0f0f0] text-[#3D1F0B]/50'
                                  : 'bg-[#8B1A1A]/8 text-[#8B1A1A]',
                            ].join(' ')}
                          >
                            {time}
                          </span>
                        </td>

                        {/* Activity cell */}
                        <td className="pr-6 py-3.5 align-top text-right">
                          <p
                            className={[
                              'text-sm font-medium leading-snug',
                              isBreak
                                ? 'text-[#3D1F0B]/50'
                                : 'text-[#3D1F0B]',
                            ].join(' ')}
                          >
                            {activity}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Bottom strip ──────────────────────────────────────────────── */}
        <div className="mt-10 bg-gradient-to-r from-[#8B1A1A] to-[#5a0f0f] text-white rounded-2xl px-8 py-8 text-center shadow-lg">
          <p className="text-[#F5E6B8] text-xl font-semibold mb-1">
            TheMarriageHome.com
          </p>
          <p className="text-white/60 text-sm">
            Your trusted partner in finding meaningful, lifelong connections.
          </p>
        </div>
      </section>
    </>
  );
}
