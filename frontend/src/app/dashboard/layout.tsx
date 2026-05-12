"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getUser, isAuthenticated, clearAuth, profilesApi } from "@/lib/api";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Search,
  Heart,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import type { Profile, User } from "@/types";
import Image from "next/image";
import {
  DashboardNavProfilesContext,
  type DashboardNavProfilesContextValue,
} from "./dashboard-nav-profiles-context";

// ─── Nav (shared) — “New Registration” hidden when user already has ≥1 profile ───

const NAV_ITEMS = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    hi: "डैशबोर्ड",
  },
  // {
  //   href: "/register",
  //   icon: UserPlus,
  //   label: "New Registration",
  //   hi: "नया पंजीकरण",
  // },
  { href: "/profiles", icon: Users, label: "My Profiles", hi: "मेरे प्रोफाइल" },
  {
    href: "/search",
    icon: Search,
    label: "Search Matches",
    hi: "रिश्ते खोजें",
  },
  { href: "/donation", icon: Heart, label: "Donations", hi: "दान" },
];

function DashboardLayoutInner({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [myProfileCount, setMyProfileCount] = useState<number | null>(null);
  const [myProfilesLoading, setMyProfilesLoading] = useState(true);
  const searchParams = useSearchParams();

  const editId = searchParams.get("edit");
  const refreshMyProfiles = useCallback(async () => {
    try {
      const list = (await profilesApi.list()) as Profile[];
      setMyProfileCount(Array.isArray(list) ? list.length : 0);
    } catch {
      setMyProfileCount(0);
    } finally {
      setMyProfilesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMyProfiles();
  }, [refreshMyProfiles]);

  const navItems = useMemo(() => {
    const hideNewRegister =
      !myProfilesLoading && myProfileCount !== null && myProfileCount >= 1;
    if (hideNewRegister) {
      return NAV_ITEMS.filter((item) => item.href !== "/register");
    }
    return NAV_ITEMS;
  }, [myProfileCount, myProfilesLoading]);

  const ctxValue = useMemo<DashboardNavProfilesContextValue>(
    () => ({
      myProfileCount,
      myProfilesLoading,
      refreshMyProfiles,
    }),
    [myProfileCount, myProfilesLoading, refreshMyProfiles],
  );

  const handleLogout = () => {
    clearAuth();
    router.push("/");
  };

  return (
    <DashboardNavProfilesContext.Provider value={ctxValue}>
      <div className="h-screen bg-cream flex overflow-hidden">
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-maroon to-maroon-dark text-white transform transition-transform lg:translate-x-0 lg:static lg:h-screen lg:flex lg:flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="p-5 border-b border-white/10">
            <Link href="/dashboard" className="flex items-center gap-1">
              <Image
                className="size-12"
                unoptimized
                src={"/icons/marriagehome-logo.png"}
                width={40}
                height={40}
                alt="marriagehome-logo"
              />
              <div>
                <h2 className="font-bold text-sm">TheMarriageHome.com</h2>
                <p className="text-xs text-gold-light font-hindi">अपना जीवनसाथी खोजें</p>
              </div>
            </Link>
          </div>

          <nav className="p-3 flex-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 text-sm transition-all ${
                    active
                      ? "bg-primary text-white font-semibold shadow-lg shadow-primary/30"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {active && <ChevronRight size={14} className="ml-auto" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-white/10">
            <div className="px-4 py-2 mb-2">
              <p className="text-xs text-white/50">Logged in as</p>
              <p className="text-sm font-semibold">
                {user.name || user.mobile}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-300 hover:bg-red-500/10 w-full transition-all"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="flex-1 h-screen overflow-hidden flex flex-col">
          <header className="bg-white border-b border-[#E8D5C4] px-4 py-3 flex items-center justify-between lg:px-8 sticky top-0 z-30">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-cream-dark"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex-1 lg:flex-none">
              {/* <h1 className="text-lg font-bold text-maroon">
                {navItems.find((n) => n.href === pathname)?.label ||
                  (pathname === "/register"
                    ? "New Registration"
                    : "Dashboard")}
              </h1> */}
              <h1 className="text-lg font-bold text-maroon">
                {navItems.find((n) => n.href === pathname)?.label ||
                  (pathname === "/register"
                    ? editId
                      ? "Edit Registration"
                      : "New Registration"
                    : "Dashboard")}
              </h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-temple-brown-light">{user.role}</p>
            </div>
          </header>

          <main className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </DashboardNavProfilesContext.Provider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth");
      return;
    }
    const u = getUser();
    if (!u) {
      router.replace("/auth");
      return;
    }

    if (u.role === "ADMIN") {
      router.replace("/admin");
      return;
    }
    if (u.role === "MANAGER") {
      router.replace("/manager");
      return;
    }
    if (u.role === "TEAM") {
      router.replace("/team");
      return;
    }

    setUser(u);
  }, [router]);

  if (!user) return null;

  return <DashboardLayoutInner user={user}>{children}</DashboardLayoutInner>;
}
