"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

interface AuthContextType {
  user: { userId: string; email: string; name: string } | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ["/login", "/register"];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch("/api/auth/me", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setUser(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setUser(null);
        setLoading(false);
        window.location.href = "/login";
      });

    return () => controller.abort();
  }, [pathname]);

  if (loading) {
    if (PUBLIC_PATHS.includes(pathname)) {
      return <>{children}</>;
    }
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
