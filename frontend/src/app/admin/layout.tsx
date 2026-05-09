'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Users,
  DollarSign,
  UserPlus,
  TrendingUp,
  Image,
  Activity,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  Receipt,
  ImagePlus,
  UserCog,
  FileText,
  Loader2,
} from 'lucide-react';
import { clearAuth } from '@/lib/api';
import { AdminAuth } from '@/components/AdminAuth';
import { useAuth } from '@/lib/auth-context';

// ─── Navigation items ────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: BarChart3 },
  { label: 'Profiles', href: '/admin/profiles', icon: Users },
  { label: 'Donations', href: '/admin/donations', icon: DollarSign },
  { label: 'Sales', href: '/admin/sales', icon: Receipt },
  { label: 'Team', href: '/admin/team', icon: UserPlus },
  { label: 'Reports', href: '/admin/reports', icon: TrendingUp },
  { label: 'Gallery', href: '/admin/gallery', icon: Image },
  { label: 'Banners', href: '/admin/banners', icon: ImagePlus },
  // { label: 'Managers', href: '/admin/managers', icon: UserCog },
  { label: 'Activity Log', href: '/admin/activity', icon: Activity },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
  { label: 'Content', href: '/admin/content', icon: FileText },
];

// ─── Sidebar ────────────────────────────────────────────────────────────────

interface SidebarProps {
  onClose?: () => void;
}

function Sidebar({ onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    clearAuth();
    router.push('/');
  }

  // Exact match for /admin dashboard, prefix match for sub-routes
  function isActive(href: string): boolean {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  }

  return (
    <aside
      style={{ width: '240px', backgroundColor: '#8B1A1A' }}
      className="h-full flex flex-col"
    >
      {/* ── Header ── */}
      <div
        style={{ borderBottomColor: 'rgba(212,160,23,0.3)' }}
        className="flex items-center justify-between gap-3 px-5 py-5 border-b"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Shield size={22} className="text-gold flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-tight">Admin Panel</p>
            <p
              className="font-hindi text-xs leading-tight mt-0.5 truncate"
              style={{ color: '#F5E6B8' }}
            >
              एडमिन पैनल — रिश्तेसेतु
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
                        backgroundColor: '#D4A017',
                        color: '#3D1F0B',
                      }
                      : {
                        color: 'rgba(255,255,255,0.75)',
                      }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'rgba(255,255,255,0.10)';
                      (e.currentTarget as HTMLElement).style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'transparent';
                      (e.currentTarget as HTMLElement).style.color =
                        'rgba(255,255,255,0.75)';
                    }
                  }}
                >
                  <Icon
                    size={17}
                    className="flex-shrink-0"
                    style={active ? { color: '#3D1F0B' } : {}}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Logout ── */}
      <div
        style={{ borderTopColor: 'rgba(212,160,23,0.3)' }}
        className="px-2 py-3 border-t"
      >
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
          style={{ color: 'rgba(255,255,255,0.75)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              'rgba(220,38,38,0.35)';
            (e.currentTarget as HTMLElement).style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLElement).style.color =
              'rgba(255,255,255,0.75)';
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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);



  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Dedicated admin URL: show login directly on /admin.
      if (pathname === '/admin') {
        setAuthChecked(false);
        return;
      }
      router.replace('/admin');
      return;
    }

    if (user?.role !== 'ADMIN') {
      if (pathname === '/admin') {
        setAuthChecked(false);
        return;
      }
      router.replace('/admin');
      return;
    }
    setAuthChecked(true);
  }, [router, pathname, isAuthenticated, isLoading, user]);

  // Close overlay sidebar when viewport grows to desktop size
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent scroll on body when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    </div>;
  }

  // Render nothing until auth is confirmed to prevent flash of protected UI
  if (!authChecked) {
    // On /admin, render the dedicated admin login screen.
    if (pathname === '/admin') {
      return <AdminAuth />;
    }
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#FFFAF5' }}
      >
        <div className="flex flex-col items-center gap-3">
          <Shield size={32} style={{ color: '#8B1A1A' }} />
          <p className="text-sm font-medium" style={{ color: '#6B3A1F' }}>
            Verifying access…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: '#FFFAF5' }}
    >
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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col lg:hidden transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
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
            backgroundColor: '#8B1A1A',
            borderBottomColor: 'rgba(212,160,23,0.3)',
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
            <Shield size={18} style={{ color: '#D4A017' }} />
            <span className="font-bold text-white text-sm">Admin Panel</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
