"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import PasswordInput from "@/components/ui/PasswordInput";
import Button from "@/components/ui/Button";
import { ErrorIcon, CheckIcon } from "@/components/ui/icons";

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
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token || invalid) {
    return (
      <AuthShell
        title="Invalid link"
        subtitle="This password reset link is invalid or has expired."
        footer={
          <p className="text-center text-sm text-muted mt-5">
            <Link href="/forgot-password" className="text-primary font-medium hover:underline">
              Request a new link
            </Link>
          </p>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger/8 px-3.5 py-3">
          <div className="mt-0.5 w-8 h-8 rounded-lg bg-danger/15 flex items-center justify-center shrink-0">
            <ErrorIcon size={16} stroke="var(--danger)" />
          </div>
          <p className="text-sm text-muted">Ask for a fresh reset email and try again.</p>
        </div>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell title="Password updated" subtitle="Redirecting you to sign in…">
        <div className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/8 px-3.5 py-3">
          <div className="mt-0.5 w-8 h-8 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
            <CheckIcon size={16} stroke="var(--success)" />
          </div>
          <p className="text-sm text-muted">You can sign in with your new password.</p>
        </div>
      </AuthShell>
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
    <AuthShell
      title="Set a new password"
      subtitle="Choose something you haven’t used here before"
      footer={
        <p className="text-center text-sm text-muted mt-5">
          <Link href="/login" className="text-primary font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reset-password-new-password" className="block text-xs font-medium text-muted mb-1.5">
            New password
          </label>
          <PasswordInput
            id="reset-password-new-password"
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>
        <div>
          <label htmlFor="reset-password-confirm-password" className="block text-xs font-medium text-muted mb-1.5">
            Confirm password
          </label>
          <PasswordInput
            id="reset-password-confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Re-enter password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg">
            <ErrorIcon size={14} stroke="var(--danger)" />
            <p className="text-xs text-danger">{error}</p>
          </div>
        )}

        <Button type="submit" loading={loading}>
          {loading ? "Resetting…" : "Reset password"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
