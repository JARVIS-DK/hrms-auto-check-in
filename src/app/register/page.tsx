"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import PasswordInput from "@/components/ui/PasswordInput";

const MIN_PASSWORD_LENGTH = 8;

function ContactAdminForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"exists" | "sent" | null>(null);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/contact-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send this request");
        return;
      }
      setResult(data.exists ? "exists" : "sent");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (result === "exists") {
    return (
      <div className="space-y-3 text-left">
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">{email}</span> already has an account.
          Sign in, or reset your password if you don&apos;t remember it.
        </p>
        <Link
          href="/login"
          className="block w-full py-2.5 text-center text-white rounded-xl font-medium text-sm bg-primary hover:bg-primary-hover"
        >
          Sign in
        </Link>
        <Link
          href="/forgot-password"
          className="block w-full py-2.5 text-center border border-border rounded-xl font-medium text-sm hover:bg-background"
        >
          Forgot password
        </Link>
      </div>
    );
  }

  if (result === "sent") {
    return (
      <p className="text-sm text-muted">
        An admin has been notified about{" "}
        <span className="font-medium text-foreground">{email}</span>. If they approve it,
        you&apos;ll get an invite at that address.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
      <div>
        <label htmlFor="contact-admin-email" className="block text-xs font-medium text-muted mb-1.5">
          Your email
        </label>
        <input
          id="contact-admin-email"
          autoComplete="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-input"
          placeholder="you@example.com"
          required
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <p className="text-xs text-danger">{error}</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={loading}
        className="w-full py-2.5 text-white rounded-xl font-medium text-sm disabled:opacity-50 transition-all bg-primary hover:bg-primary-hover"
      >
        {loading ? "Checking..." : "Contact admin"}
      </button>
    </form>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invite = searchParams.get("invite");

  const [name, setName] = useState("");
  // Filled from the invite and read-only — the server rejects any other address.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // A missing token is knowable at render time, so it starts resolved rather
  // than being set from inside an effect.
  const [checking, setChecking] = useState(Boolean(invite));
  const [inviteError, setInviteError] = useState(
    invite ? "" : "Registration is invite-only. Ask an admin for an invite link."
  );

  useEffect(() => {
    if (!invite) return;

    const controller = new AbortController();

    fetch(`/api/auth/invite?token=${encodeURIComponent(invite)}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setInviteError(data.reason || "This invite link is invalid or has expired");
        } else {
          setEmail(data.email);
        }
        setChecking(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setInviteError("Could not verify this invite link");
        setChecking(false);
      });

    return () => controller.abort();
  }, [invite]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, invite }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center bg-card/80 border border-border rounded-2xl p-8 shadow-[var(--shadow)]">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-danger/10 mx-auto">
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <h2 className="text-lg font-semibold tracking-tight mb-2">Invite Required</h2>
          <p className="text-sm text-muted mb-6">{inviteError}</p>
          <ContactAdminForm />
          <Link href="/login" className="inline-block mt-5 text-sm text-primary font-medium hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AuthShell
      title="Create an account"
      subtitle="Get started with HRMS Auto Check-in"
      footer={
        <p className="text-center text-sm text-muted mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign In
          </Link>
        </p>
      }
    >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="register-name" className="block text-xs font-medium text-muted mb-1.5">Name</label>
              <input id="register-name"
                autoComplete="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                placeholder="Your full name"
                required
              />
            </div>
            <div>
              <label htmlFor="register-email" className="block text-xs font-medium text-muted mb-1.5">Email</label>
              <input id="register-email"
                autoComplete="email"
                type="email"
                value={email}
                readOnly
                className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-background text-muted cursor-not-allowed"
              />
              <p className="text-[11px] text-muted mt-1.5">
                This invite is bound to this address.
              </p>
            </div>
            <div>
              <label htmlFor="register-password" className="block text-xs font-medium text-muted mb-1.5">Password</label>
              <PasswordInput id="register-password"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
              <p className="text-[11px] text-muted mt-1.5">
                At least {MIN_PASSWORD_LENGTH} characters, including a letter and a number.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
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
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
