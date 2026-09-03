"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import Button from "@/components/ui/Button";
import { CheckIcon, ErrorIcon } from "@/components/ui/icons";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send reset link");
        return;
      }

      setSent(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={
          <>
            If an account exists for <strong className="text-foreground">{email}</strong>, we&apos;ve
            sent a password reset link.
          </>
        }
        footer={
          <>
            <p className="text-center text-xs text-muted mt-4">The link expires in 1 hour.</p>
            <p className="text-center mt-3">
              <Link href="/login" className="text-sm text-primary font-medium hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/8 px-3.5 py-3">
          <div className="mt-0.5 w-8 h-8 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
            <CheckIcon size={16} stroke="var(--success)" />
          </div>
          <p className="text-sm text-muted">Nothing more to do here until you open that message.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your email and we’ll send a reset link"
      footer={
        <p className="text-center text-sm text-muted mt-5">
          Remember your password?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="forgot-password-email" className="block text-xs font-medium text-muted mb-1.5">
            Email
          </label>
          <input
            id="forgot-password-email"
            autoComplete="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            placeholder="you@example.com"
            required
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg">
            <ErrorIcon size={14} stroke="var(--danger)" />
            <p className="text-xs text-danger">{error}</p>
          </div>
        )}

        <Button type="submit" loading={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
