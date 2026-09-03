"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import BrandMark from "@/components/BrandMark";
import { useDialogBehaviour } from "@/components/ui/Modal";
import { PowerIcon } from "@/components/ui/icons";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/leaves",
    label: "Leaves",
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/logs",
    label: "Logs",
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/admin",
    label: "Admin",
    adminOnly: true,
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
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

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: typeof NAV_ITEMS;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const active = navActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              active
                ? "bg-primary/12 text-primary"
                : "text-muted hover:text-foreground hover:bg-white/5"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
            )}
            {item.icon}
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // AuthProvider has already resolved the session — this used to be a second
  // /api/auth/me request for the one field the context was missing.
  const { user } = useAuth();
  const userRole = user?.role ?? "user";

  // Same Escape / focus-trap / scroll-lock behaviour as the dialogs.
  const closeDrawer = useCallback(() => setSidebarOpen(false), []);
  const drawerRef = useDialogBehaviour(sidebarOpen, closeDrawer);

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
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      <header className="md:hidden sticky top-0 z-40 shrink-0 bg-card/80 border-b border-border px-4 py-3 flex items-center justify-between gap-2 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors shrink-0"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <BrandMark size={32} />
          <h1 className="text-sm font-semibold tracking-tight truncate">HRMS Auto Check-in</h1>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          className="flex items-center gap-1.5 text-sm text-muted hover:text-danger transition-colors shrink-0"
        >
          <PowerIcon />
        </button>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <nav className="hidden md:flex shrink-0 w-56 2xl:w-64 bg-card/70 border-r border-border p-3 flex-col gap-0.5 overflow-y-auto min-h-0 backdrop-blur-md">
          <div className="flex items-center gap-2.5 px-2 py-3 mb-2">
            <BrandMark size={32} />
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight leading-tight">HRMS Auto</p>
              <p className="text-[11px] text-muted">Check-in</p>
            </div>
          </div>
          <NavLinks items={visibleNavItems} pathname={pathname} />
          {userBlock}
        </nav>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-50 md:hidden animate-[fadeIn_150ms_ease-out]"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
            <nav
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border p-4 flex flex-col gap-1 overflow-y-auto animate-[slideIn_200ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <BrandMark size={32} />
                  <span className="text-sm font-semibold tracking-tight">Menu</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close navigation menu"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <NavLinks items={visibleNavItems} pathname={pathname} onNavigate={() => setSidebarOpen(false)} />
              {userBlock}
            </nav>
          </div>
        )}

        <main className="flex-1 min-w-0 w-full min-h-0 p-4 md:p-6 2xl:p-10 overflow-y-auto overscroll-none">{children}</main>
      </div>
    </div>
  );
}
