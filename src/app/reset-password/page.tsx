"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PasswordInput from "@/components/ui/PasswordInput";

// Kept in step with validatePassword() in lib/account.ts.
const MIN_PASSWORD_LENGTH = 8;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // A missing token is knowable at render time — deriving it here avoids an
  // effect that immediately sets state and re-renders.
  const [validating, setValidating] = useState(Boolean(token));
  const [invalid, setInvalid] = useState(!token);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) setInvalid(true);
      })
      .catch(() => setInvalid(true))
      .finally(() => setValidating(false));
  }, [token]);

  if (validating) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token || invalid) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-danger/10 mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <h2 className="text-lg font-bold mb-2">Invalid Link</h2>
          <p className="text-sm text-muted">This password reset link is invalid or has expired.</p>
          <Link href="/forgot-password" className="inline-block mt-6 text-sm text-primary font-medium hover:underline">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-success/10 mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success, #22c55e)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2">Password Reset Successful</h2>
          <p className="text-sm text-muted">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-xl font-bold">Set New Password</h1>
          <p className="text-sm text-muted mt-1">Enter your new password below</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">New Password</label>
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Confirm Password</label>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Re-enter password"
                required
                minLength={MIN_PASSWORD_LENGTH}
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
                  Resetting...
                </span>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted mt-5">
          <Link href="/login" className="text-primary font-medium hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
