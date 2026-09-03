"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import PasswordInput from "@/components/ui/PasswordInput";
import Button, { buttonClass } from "@/components/ui/Button";
import { InfoIcon, CheckIcon, ErrorIcon } from "@/components/ui/icons";

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
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-3">
          <div className="mt-0.5 w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <InfoIcon size={16} stroke="var(--primary)" />
          </div>
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">{email}</span> already has an account.
            Sign in, or reset your password if you don&apos;t remember it.
          </p>
        </div>
        <Link href="/login" className={buttonClass("primary")}>
          Sign in
        </Link>
        <Link href="/forgot-password" className={buttonClass("ghost")}>
          Forgot password
        </Link>
      </div>
    );
  }

  if (result === "sent") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/8 px-3.5 py-3">
        <div className="mt-0.5 w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
          <CheckIcon size={16} stroke="var(--success)" />
        </div>
        <p className="text-sm text-muted">
          An admin has been notified about{" "}
          <span className="font-medium text-foreground">{email}</span>. If they approve it,
          you&apos;ll get an invite at that address.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
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
          <ErrorIcon size={14} stroke="var(--danger)" />
          <p className="text-xs text-danger">{error}</p>
        </div>
      )}
      <Button type="button" onClick={() => void handleSubmit()} loading={loading}>
        {loading ? "Checking…" : "Contact admin"}
      </Button>
    </form>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invite = searchParams.get("invite");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      <AuthShell
        title="Invite required"
        subtitle={inviteError}
        footer={
          <p className="text-center text-sm text-muted mt-5">
            <Link href="/login" className="text-primary font-medium hover:underline">
              Back to sign in
            </Link>
          </p>
        }
      >
        <ContactAdminForm />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="This invite is locked to the email below"
      footer={
        <p className="text-center text-sm text-muted mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="register-name" className="block text-xs font-medium text-muted mb-1.5">
            Name
          </label>
          <input
            id="register-name"
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
          <label htmlFor="register-email" className="block text-xs font-medium text-muted mb-1.5">
            Email
          </label>
          <input
            id="register-email"
            autoComplete="email"
            type="email"
            value={email}
            readOnly
            className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-background text-muted cursor-not-allowed"
          />
        </div>
        <div>
          <label htmlFor="register-password" className="block text-xs font-medium text-muted mb-1.5">
            Password
          </label>
          <PasswordInput
            id="register-password"
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
            <ErrorIcon size={14} stroke="var(--danger)" />
            <p className="text-xs text-danger">{error}</p>
          </div>
        )}

        <Button type="submit" loading={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
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
