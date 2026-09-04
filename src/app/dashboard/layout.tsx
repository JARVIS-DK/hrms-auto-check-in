"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import BrandMark from "@/components/BrandMark";
import {
  PowerIcon,
  OverviewIcon,
  SettingsIcon,
  CalendarIcon,
  ActivityIcon,
  ShieldIcon,
} from "@/components/ui/icons";
import PullToRefresh, { PullRefreshProvider } from "@/components/ui/PullToRefresh";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Overview",
    short: "Home",
    icon: OverviewIcon,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    short: "Settings",
    icon: SettingsIcon,
  },
  {
    href: "/dashboard/leaves",
    label: "Leaves",
    short: "Leaves",
    icon: CalendarIcon,
  },
  {
    href: "/dashboard/logs",
    label: "Logs",
    short: "Logs",
    icon: ActivityIcon,
  },
  {
    href: "/dashboard/admin",
    label: "Admin",
    short: "Admin",
    adminOnly: true,
    icon: ShieldIcon,
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function navActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function DesktopNavLinks({
  items,
  pathname,
}: {
  items: typeof NAV_ITEMS;
  pathname: string;
}) {
  return (
    <>
      {items.map((item) => {
        const active = navActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              active
                ? "bg-primary/12 text-primary"
                : "text-muted hover:text-foreground hover:bg-white/5"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
            )}
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const userRole = user?.role ?? "user";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || userRole === "admin");

  const userBlock = (
    <div className="mt-auto pt-3 border-t border-border">
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <div className="w-8 h-8 rounded-full bg-primary/15 text-primary text-[11px] font-semibold flex items-center justify-center shrink-0">
          {user ? initials(user.name) : "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <p className="text-[11px] text-muted truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
        >
          <PowerIcon />
        </button>
      </div>
    </div>
  );

  return (
    <PullRefreshProvider>
      <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
        <header className="md:hidden sticky top-0 z-40 shrink-0 bg-card/85 border-b border-border px-4 py-3 flex items-center justify-between gap-2 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandMark size={32} />
            <div className="min-w-0">
              <h1 className="font-display text-sm tracking-tight truncate leading-tight">ShiftSync</h1>
              <p className="text-[11px] text-muted truncate">Check in/out</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Log out"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
          >
            <PowerIcon />
          </button>
        </header>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <nav className="hidden md:flex shrink-0 w-56 2xl:w-64 bg-card/70 border-r border-border p-3 flex-col gap-0.5 overflow-y-auto min-h-0 backdrop-blur-md">
            <div className="flex items-center gap-2.5 px-2 py-3 mb-2">
              <BrandMark size={32} />
              <div className="min-w-0">
                <p className="font-display text-[0.95rem] tracking-tight leading-tight">ShiftSync</p>
                <p className="text-[11px] text-muted">Check in/out</p>
              </div>
            </div>
            <DesktopNavLinks items={visibleNavItems} pathname={pathname} />
            {userBlock}
          </nav>

          <main className="flex-1 min-w-0 w-full min-h-0 flex flex-col">
            <PullToRefresh className="flex-1 min-h-0 p-4 pb-2 md:p-6 2xl:p-10 overflow-y-auto overscroll-contain">
              {children}
            </PullToRefresh>
          </main>
        </div>

        <div className="md:hidden shrink-0 px-3 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none">
          <nav
            aria-label="Primary"
            className="pointer-events-auto rounded-2xl border border-border/80 bg-card/90 shadow-[0_-1px_0_rgba(255,255,255,0.06)_inset,0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <ul className="relative flex items-stretch gap-0.5 p-1.5">
              {visibleNavItems.map((item) => {
                const active = navActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href} className="relative flex-1 min-w-0">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative z-[1] flex flex-col items-center justify-center gap-1 min-h-[3.25rem] px-1 rounded-xl transition-colors ${
                        active ? "text-primary" : "text-muted active:text-foreground"
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 rounded-xl bg-primary/14 ring-1 ring-primary/25"
                        />
                      )}
                      <span className="relative flex items-center justify-center">
                        <Icon size={20} strokeWidth={active ? 2.25 : 2} />
                      </span>
                      <span
                        className={`relative text-[10px] leading-none tracking-wide truncate max-w-full ${
                          active ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {item.short}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </PullRefreshProvider>
  );
}
