"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  ArrowUp,
  Phone,
  MessageCircle,
  User,
  LogOut,
  LayoutDashboard,
  Shield,
  Users,
} from "lucide-react";
import { isAuthenticated, getUser, clearAuth } from "@/lib/api";
import { OmSymbol } from "@/components/OmSymbol";
import Image from "next/image";

// ─── Temple constants ─────────────────────────────────────────────────────────

const TEMPLE = {
  name: "Mandir",
  nameHi: "मंदिर",
  tagline: "Geeta Colony, East Delhi",
  taglineHi: "गीता कॉलोनी, पूर्वी दिल्ली",
  address:
    "Mandir Geeta Colony, Ram Lila Ground Chowk, East Delhi — 110031",
  phone: "+91 9810277873",
  email: "hanumanmandirgeetacolony@gmail.com",
  committee: "Managed by Geeta Colony Dharmik Ramlila Committee (Reg. 1962).",
  mapsUrl: "https://maps.google.com/?q=Hanuman+Murti+Geeta+Colony+Delhi",
};

const PHONE_NUMBERS = ["9810277873", "9899957029"] as const;
function telHref(num: string) {
  return `tel:+91${num.replace(/\\D/g, "")}`;
}
function waHref(num: string) {
  return `https://wa.me/${num.replace(/\\D/g, "")}`;
}

const NAV = [
  { href: "/", label: "Home", hi: "होम" },
  { href: "/about", label: "About", hi: "परिचय" },
  { href: "/register", label: "Matrimony", hi: "विवाह" },
  { href: "/gallery", label: "Gallery", hi: "गैलरी" },
  { href: "/events", label: "Events", hi: "कार्यक्रम" },
  { href: "/donation", label: "Donation", hi: "दान" },
  { href: "/contact", label: "Contact", hi: "संपर्क" },
];

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const [authUser, setAuthUser] = useState<{
    name: string | null;
    role: string;
    mobile: string;
  } | null>(null);

  // Check auth state on mount and pathname change
  useEffect(() => {
    if (isAuthenticated()) {
      const u = getUser();
      if (u) setAuthUser({ name: u.name, role: u.role, mobile: u.mobile });
      else setAuthUser(null);
    } else {
      setAuthUser(null);
    }
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!userDropdown) return;
    const handler = () => setUserDropdown(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [userDropdown]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const handleLogout = () => {
    clearAuth();
    setAuthUser(null);
    setUserDropdown(false);
    window.location.href = "/";
  };

  const dashboardHref =
    authUser?.role === "ADMIN"
      ? "/admin"
      : authUser?.role === "MANAGER"
        ? "/manager"
        : authUser?.role === "TEAM"
          ? "/team"
          : "/dashboard";
  const initial =
    authUser?.name?.[0]?.toUpperCase() || authUser?.mobile?.[0] || "U";

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-maroon-dark via-maroon to-maroon-dark shadow-lg shadow-black/30">
      {/* ── Desktop header ───────────────────────────────────────── */}
      <div className="hidden lg:flex items-center justify-between max-w-7xl mx-auto px-6 py-3 gap-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 flex-shrink-0 group"
          aria-label="Home — Mandir"
        >
          <Image
            className="size-8"
            unoptimized
            src={"/icons/om-icon-v2.png"}
            width={32}
            height={32}
            alt="om-logo"
          />
          <div className="leading-tight">
            <p className="font-bold text-white text-sm tracking-wide group-hover:text-gold transition-colors duration-200">
              {TEMPLE.name}
            </p>
            <p className="font-hindi text-gold text-xs mt-0.5">
              {TEMPLE.nameHi}
            </p>
          </div>
        </Link>

        {/* Nav links */}
        <nav aria-label="Primary navigation">
          <ul className="flex items-center gap-1" role="list">
            {NAV.map(({ href, label, hi }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "relative flex flex-col items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                      active
                        ? "text-gold bg-white/10"
                        : "text-white/80 hover:text-white hover:bg-white/10",
                    ].join(" ")}
                  >
                    <span>{label}</span>
                    <span className="font-hindi text-[10px] leading-none mt-0.5 opacity-70">
                      {hi}
                    </span>
                    {active && (
                      <span
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-gold"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* CTA / User Avatar */}
        {authUser ? (
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUserDropdown((o) => !o);
              }}
              className="flex items-center gap-2.5 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-2 transition-all duration-200"
            >
              <div className="w-8 h-8 rounded-full bg-gold text-temple-brown flex items-center justify-center font-bold text-sm">
                {initial}
              </div>
              <div className="text-left hidden xl:block">
                <p className="text-white text-xs font-semibold leading-tight truncate max-w-[120px]">
                  {authUser.name || authUser.mobile}
                </p>
                <p className="text-gold/70 text-[10px] leading-tight">
                  {authUser.role}
                </p>
              </div>
            </button>

            {userDropdown && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {authUser.name || "User"}
                  </p>
                  <p className="text-xs text-gray-400">{authUser.mobile}</p>
                </div>
                <Link
                  href={dashboardHref}
                  onClick={() => setUserDropdown(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {authUser.role === "ADMIN" ? (
                    <Shield size={15} className="text-maroon" />
                  ) : authUser.role === "TEAM" ? (
                    <Users size={15} className="text-blue-600" />
                  ) : (
                    <LayoutDashboard size={15} className="text-primary" />
                  )}
                  {authUser.role === "ADMIN"
                    ? "Admin Panel"
                    : authUser.role === "MANAGER"
                      ? "Manager Panel"
                      : authUser.role === "TEAM"
                        ? "Team Panel"
                        : "Dashboard"}
                </Link>
                {authUser.role === "USER" && (
                  <Link
                    href="/profiles"
                    onClick={() => setUserDropdown(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User size={15} className="text-gray-400" />
                    My Profiles
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full border-t border-gray-100"
                >
                  <LogOut size={15} />
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/register"
            className="flex-shrink-0 bg-gold hover:bg-yellow-500 text-temple-brown font-bold text-sm px-5 py-2.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 shadow-md shadow-black/20 whitespace-nowrap"
          >
            Register Now
          </Link>
        )}
      </div>

      {/* ── Mobile header ────────────────────────────────────────── */}
      <div className="flex lg:hidden items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link
          href="/"
          onClick={closeMenu}
          className="flex items-center gap-2.5"
          aria-label="Home — Mandir"
        >
          <Image
            className="size-7 mx-auto"
            src={"/icons/om-icon-v2.png"}
            width={28}
            height={28}
            alt="om-logo"
          />
          <div className="leading-tight">
            <p className="font-bold text-white text-xs tracking-wide">
              {TEMPLE.name}
            </p>
            <p className="font-hindi text-gold text-[10px] mt-0.5">
              {TEMPLE.nameHi}
            </p>
          </div>
        </Link>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── Mobile slide-down menu ────────────────────────────────── */}
      <div
        id="mobile-menu"
        role="navigation"
        aria-label="Mobile navigation"
        className={[
          "lg:hidden overflow-hidden transition-all duration-300 ease-in-out",
          menuOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="border-t border-gold/20 px-4 pb-4 pt-2 bg-gradient-to-b from-maroon-dark/80 to-maroon-dark">
          <ul className="space-y-0.5" role="list">
            {NAV.map(({ href, label, hi }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={closeMenu}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-gold text-temple-brown font-bold"
                        : "text-white/80 hover:text-white hover:bg-white/10",
                    ].join(" ")}
                  >
                    <span>{label}</span>
                    <span
                      className={[
                        "font-hindi text-xs",
                        active ? "text-temple-brown/80" : "text-gold/70",
                      ].join(" ")}
                    >
                      {hi}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Mobile CTA / User info */}
          <div className="mt-3 pt-3 border-t border-gold/20">
            {authUser ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-4 py-2">
                  <div className="w-9 h-9 rounded-full bg-gold text-temple-brown flex items-center justify-center font-bold text-sm">
                    {initial}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">
                      {authUser.name || authUser.mobile}
                    </p>
                    <p className="text-gold/60 text-xs">{authUser.role}</p>
                  </div>
                </div>
                <Link
                  href={dashboardHref}
                  onClick={closeMenu}
                  className="flex items-center justify-center w-full bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-all"
                >
                  {authUser.role === "ADMIN"
                    ? "Admin Panel"
                    : authUser.role === "MANAGER"
                      ? "Manager Panel"
                      : authUser.role === "TEAM"
                        ? "Team Panel"
                        : "Dashboard"}
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    closeMenu();
                  }}
                  className="flex items-center justify-center gap-2 w-full text-red-400 hover:text-red-300 text-sm py-2 transition-colors"
                >
                  <LogOut size={14} /> Logout
                </button>
              </div>
            ) : (
              <Link
                href="/register"
                onClick={closeMenu}
                className="flex items-center justify-center w-full bg-gold hover:bg-yellow-500 text-temple-brown font-bold text-sm px-5 py-3 rounded-xl transition-all duration-200"
              >
                Register Now — विवाह पंजीकरण
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Floating Buttons ─────────────────────────────────────────────────────────

function FloatingButtons() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 400);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Run once on mount in case the page starts scrolled
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div
      className="fixed bottom-6 right-5 z-50 flex flex-col items-center gap-3"
      aria-label="Quick actions"
    >
      {/* Scroll-to-top — visible only after 400 px of scroll */}
      <button
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className={[
          "w-11 h-11 rounded-full bg-maroon hover:bg-maroon-dark text-white flex items-center justify-center shadow-lg shadow-black/30 transition-all duration-300",
          showScrollTop
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none",
        ].join(" ")}
      >
        <ArrowUp size={18} />
      </button>

      {/* Phone call */}
      <div className="flex flex-col gap-3">
        {PHONE_NUMBERS.map((num) => (
          <a
            key={num}
            href={telHref(num)}
            aria-label={`Call temple: +91 ${num}`}
            className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5"
          >
            <Phone size={18} />
          </a>
        ))}
      </div>

      {/* WhatsApp */}
      <a
        href={waHref(PHONE_NUMBERS[0])}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="w-11 h-11 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5"
      >
        <MessageCircle size={18} />
      </a>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-br from-[#1a0505] to-[#2A0808] text-white/70">
      {/* ── 4-column grid ─────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        {/* Col 1 — Temple identity */}
        <div className="space-y-3">
          <Link href="/" >
          <div className="flex items-center gap-2.5">
            <Image
              className="size-8"
              src={"/icons/om-icon-v2.png"}
              width={32}
              height={32}
              alt="om-logo"
            />
            <div>
              <p className="font-bold text-white text-sm leading-snug">
                {TEMPLE.name}
              </p>
            </div>
          </div>
          </Link>
          <p className="font-hindi text-gold text-base leading-snug">
            {TEMPLE.nameHi}
          </p>
          <p className="font-hindi text-gold-light/80 text-sm leading-snug">
            {TEMPLE.taglineHi}
          </p>
          <p className="text-xs text-white/50 leading-relaxed">
            {TEMPLE.committee}
          </p>
        </div>

        {/* Col 2 — Quick links */}
        <div className="space-y-3">
          <h3 className="font-bold text-white text-sm tracking-wide uppercase">
            Quick Links
          </h3>
          <ul className="space-y-2" role="list">
            {NAV.map(({ href, label, hi }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex items-center gap-2 text-sm text-white/60 hover:text-gold transition-colors duration-200"
                >
                  <span className="w-1 h-1 rounded-full bg-gold/50 group-hover:bg-gold transition-colors duration-200 flex-shrink-0" />
                  <span>
                    {label}
                    <span className="font-hindi text-xs ml-1 text-white/40 group-hover:text-gold/60 transition-colors duration-200">
                      {hi}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3 — Address */}
        <div className="space-y-3">
          <h3 className="font-bold text-white text-sm tracking-wide uppercase">
            Temple Address
          </h3>
          <address className="not-italic space-y-2 text-sm text-white/60 leading-relaxed">
            <p>
              Mandir
              <br />
              Geeta Colony, Ram Lila Ground Chowk, East Delhi — 110031
            </p>
          </address>
          <a
            href={TEMPLE.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-yellow-400 transition-colors duration-200 mt-1"
          >
            <span>View on Google Maps</span>
            <span aria-hidden="true">↗</span>
          </a>
          <div className="pt-1 space-y-1">
            {PHONE_NUMBERS.map((num) => (
              <a
                key={num}
                href={telHref(num)}
                className="block text-sm text-white/60 hover:text-gold transition-colors duration-200 break-all"
              >
                +91 {num}
              </a>
            ))}
            <a
              href={`mailto:${TEMPLE.email}`}
              className="block text-xs text-white/50 hover:text-gold/80 transition-colors duration-200 break-all"
            >
              {TEMPLE.email}
            </a>
          </div>
        </div>

        {/* Col 4 — Temple timings */}
        <div className="space-y-3">
          <h3 className="font-bold text-white text-sm tracking-wide uppercase">
            Temple Timings
          </h3>
          <div className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <p className="text-gold font-semibold">Morning Session</p>
              <p className="text-white/60">5:00 AM – 12:00 PM</p>
              <p className="font-hindi text-white/40 text-xs">प्रातः काल</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-gold font-semibold">Evening Session</p>
              <p className="text-white/60">4:00 PM – 9:30 PM</p>
              <p className="font-hindi text-white/40 text-xs">सायं काल</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-gold font-semibold">Aarti Times</p>
              <p className="text-white/60">6:30 AM &amp; 7:30 PM</p>
              <p className="font-hindi text-white/40 text-xs">आरती समय</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────────── */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/40">
          <p>
            &copy; {currentYear} RishteNate. {TEMPLE.committee}
          </p>
          <p className="font-hindi text-gold/60 text-sm">।। जय श्री राम ।।</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Public Layout ────────────────────────────────────────────────────────────

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <FloatingButtons />
      <Footer />
    </>
  );
}
