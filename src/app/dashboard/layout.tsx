"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/leaves", label: "Leaves" },
  { href: "/dashboard/logs", label: "Logs" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">HRMS Auto Check-in</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-muted hover:text-danger"
        >
          Logout
        </button>
      </header>
      <div className="flex-1 flex">
        <nav className="w-48 bg-card border-r border-border p-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                pathname === item.href
                  ? "bg-primary text-white"
                  : "text-foreground hover:bg-background"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
