import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

// Exact matches — `startsWith` would have made "/login-as-admin" public too.
const PUBLIC_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

const PUBLIC_APIS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/invite",
  "/api/cron",
];

/**
 * Renamed from `middleware` per Next 16 — see
 * node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md.
 * Proxy runs on the Node.js runtime, which is what lets us actually verify the
 * JWT here; the old edge middleware could only check that a cookie existed, so
 * any non-empty value walked straight past it.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("auth_token")?.value;
  const user = token ? verifyToken(token) : null;

  if (PUBLIC_PAGES.includes(pathname) || PUBLIC_APIS.includes(pathname)) {
    if (user && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    // Clear a token that's expired or forged so the client stops resending it.
    const res = NextResponse.redirect(login);
    if (token) res.cookies.delete("auth_token");
    return res;
  }

  // Admin pages are additionally enforced by requireAdmin() in each route —
  // this only avoids rendering a shell the user can't populate.
  if (pathname.startsWith("/dashboard/admin") && user.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
