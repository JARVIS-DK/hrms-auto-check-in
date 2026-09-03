"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import PasswordInput from "@/components/ui/PasswordInput";
import Button from "@/components/ui/Button";
import { ErrorIcon } from "@/components/ui/icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your work email to open the dashboard"
      footer={
        <p className="text-center text-sm text-muted mt-5">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Register
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="block text-xs font-medium text-muted mb-1.5">
            Email
          </label>
          <input
            id="login-email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-xs font-medium text-muted mb-1.5">
            Password
          </label>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            placeholder="Enter your password"
            required
          />
          <div className="mt-1.5 text-right">
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg">
            <ErrorIcon size={14} stroke="var(--danger)" />
            <p className="text-xs text-danger">{error}</p>
          </div>
        )}

        <Button type="submit" loading={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
