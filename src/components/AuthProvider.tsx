"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export interface AuthUser {
  userId: number;
  email: string;
  name: string;
  role: "admin" | "user";
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Public pages have nothing to wait for, so they start resolved rather than
  // flipping loading off from inside an effect.
  const isPublic = PUBLIC_PATHS.includes(usePathname());
  const [loading, setLoading] = useState(!isPublic);
  const router = useRouter();

  // Runs once per mount, not once per navigation. Keying this on `pathname`
  // meant every route change refetched /api/auth/me and blanked the whole app
  // to a "Loading..." screen while it was in flight.
  useEffect(() => {
    if (isPublic) return;

    const controller = new AbortController();

    fetch("/api/auth/me", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data: AuthUser) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setUser(null);
        setLoading(false);
        router.replace("/login");
      });

    return () => controller.abort();
  }, [isPublic, router]);

  if (isPublic) {
    return <AuthContext.Provider value={{ user, loading: false }}>{children}</AuthContext.Provider>;
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}
