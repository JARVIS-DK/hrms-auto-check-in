"use client";

import { useState } from "react";
import Link from "next/link";

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
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm 2xl:max-w-md text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2">Check Your Email</h2>
          <p className="text-sm text-muted">
            We&apos;ve sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your password.
          </p>
          <p className="text-xs text-muted mt-4">The link expires in 1 hour.</p>
          <Link href="/login" className="inline-block mt-6 text-sm text-primary font-medium hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm 2xl:max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-primary/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold">Reset Password</h1>
          <p className="text-sm text-muted mt-1">Enter your email to receive a reset link</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Email</label>
              <input
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-white rounded-xl font-medium text-sm disabled:opacity-50 transition-all bg-primary hover:bg-primary-hover"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted mt-5">
          Remember your password?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
