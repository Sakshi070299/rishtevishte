'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Users,
  Download,
  Printer,
  Activity,
  LogOut,
  Menu,
  X,
  UserPlus,
} from 'lucide-react';
import { getUser, isAuthenticated, clearAuth } from '@/lib/api';

// ─── Navigation items ────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',        href: '/team',          icon: BarChart3  },
  { label: 'New Registration', href: '/team/register',  icon: UserPlus   },
  { label: 'Profiles',         href: '/team/profiles', icon: Users      },
  { label: 'Export',           href: '/team/export',   icon: Download   },
  { label: 'Print Forms',      href: '/team/print',    icon: Printer    },
  { label: 'My Activity',      href: '/team/activity', icon: Activity   },
];

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  onClose?: () => void;
}

function Sidebar({ onClose }: SidebarProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const user     = getUser();

  function handleLogout() {
    clearAuth();
    router.push('/');
  }

  // Exact match for /team dashboard, prefix match for sub-routes
  function isActive(href: string): boolean {
    if (href === '/team') return pathname === '/team';
    return pathname.startsWith(href);
  }

  return (
    <aside
      style={{ width: '240px', backgroundColor: '#1D4ED8' }}
      className="h-full flex flex-col"
    >
      {/* ── Header ── */}
      <div
        style={{ borderBottomColor: 'rgba(219,234,254,0.25)' }}
        className="flex items-center justify-between gap-3 px-5 py-5 border-b"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Users size={22} className="text-blue-200 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-tight">Team Panel</p>
            <p
              className="font-hindi text-xs leading-tight mt-0.5 truncate"
              style={{ color: '#BFDBFE' }}
            >
              टीम पैनल — रिश्तेसेतु
            </p>
          </div>
        </div>

        {/* Close button — only rendered when sidebar is overlaid on mobile */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="text-white/60 hover:text-white transition-colors flex-shrink-0 lg:hidden"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* ── Nav links ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                  style={
                    active
                      ? {
                          backgroundColor: '#EFF6FF',
                          color: '#1D4ED8',
                        }
                      : {
                          color: 'rgba(255,255,255,0.80)',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'rgba(255,255,255,0.12)';
                      (e.currentTarget as HTMLElement).style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'transparent';
                      (e.currentTarget as HTMLElement).style.color =
                        'rgba(255,255,255,0.80)';
                    }
                  }}
                >
                  <Icon
                    size={17}
                    className="flex-shrink-0"
                    style={active ? { color: '#1D4ED8' } : {}}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── User info + Logout ── */}
      <div
        style={{ borderTopColor: 'rgba(219,234,254,0.25)' }}
        className="px-2 py-3 border-t space-y-1"
      >
        {/* Logged-in user display */}
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: 'rgba(219,234,254,0.20)', color: '#BFDBFE' }}
            >
              {(user.name ?? user.mobile).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {user.name ?? 'Team Member'}
              </p>
              <p className="text-xs leading-tight truncate" style={{ color: '#93C5FD' }}>
                {user.mobile}
              </p>
            </div>
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
          style={{ color: 'rgba(255,255,255,0.80)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              'rgba(220,38,38,0.30)';
            (e.currentTarget as HTMLElement).style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLElement).style.color =
              'rgba(255,255,255,0.80)';
          }}
        >
          <LogOut size={17} className="flex-shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [authChecked, setAuthChecked]   = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/auth?type=TEAM');
      return;
    }
    const user = getUser();
    if (user?.role !== 'TEAM' && user?.role !== 'ADMIN') {
      router.replace('/auth?type=TEAM');
      return;
    }
    setAuthChecked(true);
  }, [router]);

  // Close overlay sidebar when viewport grows to desktop size
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll while mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // Render nothing until auth is confirmed to prevent flash of protected UI
  if (!authChecked) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-50"
      >
        <div className="flex flex-col items-center gap-3">
          <Users size={32} style={{ color: '#1D4ED8' }} />
          <p className="text-sm font-medium text-blue-700">
            Verifying access…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* ── Desktop sidebar (always visible ≥ lg) ── */}
      <div className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-30" style={{ width: '240px' }}>
        <Sidebar />
      </div>

      {/* ── Mobile sidebar backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile sidebar drawer ── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex flex-col lg:hidden transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '240px' }}
        aria-label="Navigation drawer"
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 lg:pl-[240px]">
        {/* Mobile top bar */}
        <header
          className="lg:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-20 border-b"
          style={{
            backgroundColor: '#1D4ED8',
            borderBottomColor: 'rgba(219,234,254,0.25)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="text-white/80 hover:text-white transition-colors"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Users size={18} className="text-blue-200" />
            <span className="font-bold text-white text-sm">Team Panel</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
