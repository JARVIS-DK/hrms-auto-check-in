import dns from "dns";
import nodemailer from "nodemailer";

// Dev-only DNS override (see lib/db.ts) — the platform resolver is correct in production.
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000,
  socketTimeout: 10000,
});

const FROM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER!;

/**
 * Escape before interpolating anything user-supplied into an email body.
 * Leave reasons and HRMS error strings both reach these templates verbatim.
 */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SHELL = (inner: string) =>
  `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">${inner}</div>`;

const FOOTNOTE = (text: string) =>
  `<p style="color: #6b7280; font-size: 13px;">${text}</p>`;

/** Sending must never take down the job that triggered it. */
async function send(to: string, subject: string, html: string, label: string) {
  try {
    await transporter.sendMail({ from: FROM_EMAIL, to, subject, html });
    console.log(`[MAIL] ${label} sent`);
  } catch (err) {
    console.error(`[MAIL] Failed to send ${label}:`, err);
  }
}

function istTimestamp(): string {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function formatIstDate(date: string): string {
  // Anchor to IST explicitly — on a UTC host, parsing "T00:00" as local time
  // and formatting without a zone renders the wrong day for half the year.
  return new Date(`${date}T00:00:00.000+05:30`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function sendFailureEmail(
  to: string,
  action: "CHECK_IN" | "CHECK_OUT",
  errorMessage: string
) {
  const actionLabel = action === "CHECK_IN" ? "Check-in" : "Check-out";

  await send(
    to,
    `[ShiftSync] ${actionLabel} Failed`,
    SHELL(`
      <h2 style="color: #ef4444; margin-bottom: 16px;">${actionLabel} Failed</h2>
      <p style="color: #374151; line-height: 1.6;">
        Your automated ${actionLabel.toLowerCase()} failed at <strong>${esc(istTimestamp())}</strong>.
      </p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
        <p style="color: #991b1b; margin: 0; font-size: 14px;"><strong>Error:</strong> ${esc(errorMessage)}</p>
      </div>
      ${FOOTNOTE("Please check your HRMS credentials or try a manual check-in from the dashboard.")}
    `),
    `failure notification for ${action}`
  );
}

/**
 * Benign "nothing to do" notice — a manual check-in the scheduler found already
 * recorded, for instance. Deliberately not the red failure template: nothing
 * went wrong and the user should not be alarmed into re-checking anything.
 */
export async function sendSkipEmail(
  to: string,
  action: "CHECK_IN" | "CHECK_OUT",
  detail: string
) {
  const actionLabel = action === "CHECK_IN" ? "Check-in" : "Check-out";

  await send(
    to,
    `[ShiftSync] ${actionLabel} Not Needed`,
    SHELL(`
      <h2 style="color: #3b82f6; margin-bottom: 16px;">${actionLabel} Skipped</h2>
      <p style="color: #374151; line-height: 1.6;">
        The scheduler did not need to ${actionLabel.toLowerCase()} for you at
        <strong>${esc(istTimestamp())}</strong>.
      </p>
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
        <p style="color: #1e40af; margin: 0; font-size: 14px;">${esc(detail)}</p>
      </div>
      ${FOOTNOTE("No action is needed from you. Your attendance is already recorded.")}
    `),
    `skip notification for ${action}`
  );
}

export async function sendResetLinkEmail(to: string, resetUrl: string) {
  await send(
    to,
    "[ShiftSync] Password Reset",
    SHELL(`
      <h2 style="color: #3b82f6; margin-bottom: 16px;">Password Reset</h2>
      <p style="color: #374151; line-height: 1.6;">Click the button below to reset your password:</p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${esc(resetUrl)}" style="display: inline-block; background: #3b82f6; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
          Reset Password
        </a>
      </div>
      ${FOOTNOTE("This link is valid for 1 hour. If you did not request this, ignore this email.")}
      <p style="color: #9ca3af; font-size: 11px; margin-top: 16px; word-break: break-all;">${esc(resetUrl)}</p>
    `),
    "reset link"
  );
}

export async function sendAccessRequestEmail(
  adminEmails: string[],
  requesterEmail: string
) {
  if (adminEmails.length === 0) return;

  await send(
    adminEmails.join(", "),
    "[ShiftSync] Access request",
    SHELL(`
      <h2 style="color: #3b82f6; margin-bottom: 16px;">Someone asked for an invite</h2>
      <p style="color: #374151; line-height: 1.6;">
        <strong>${esc(requesterEmail)}</strong> does not have an account and asked an admin to send them a registration invite.
      </p>
      ${FOOTNOTE("Open Admin → Invites and create an invite for this address if they should have access.")}
    `),
    "access request"
  );
}

export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  invitedByName: string,
  expiryDays: number
) {
  await send(
    to,
    "[ShiftSync] You're invited to ShiftSync",
    SHELL(`
      <h2 style="color: #3b82f6; margin-bottom: 16px;">You're invited</h2>
      <p style="color: #374151; line-height: 1.6;">
        <strong>${esc(invitedByName)}</strong> has invited you to create an account on ShiftSync.
      </p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${esc(inviteUrl)}" style="display: inline-block; background: #3b82f6; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
          Create Your Account
        </a>
      </div>
      ${FOOTNOTE(
        `This invite is for <strong>${esc(to)}</strong> only, can be used once, and expires in ${esc(expiryDays)} days.`
      )}
      <p style="color: #9ca3af; font-size: 11px; margin-top: 16px; word-break: break-all;">${esc(inviteUrl)}</p>
    `),
    "invite link"
  );
}

/**
 * One notice for any kind of day off — personal leave or a public holiday.
 *
 * `typeLabel` is used as a heading, never dropped into a sentence: the labels
 * are user-facing phrases like "Off all day" or "Public holiday — Diwali",
 * which don't survive being inlined as "you are on ... leave today".
 */
export async function sendLeaveNotificationEmail(
  to: string,
  date: string,
  reason: string | undefined,
  typeLabel: string,
  scheduleNote: string,
  footnote = "If this is incorrect, remove the leave date from your dashboard."
) {
  await send(
    to,
    `[ShiftSync] ${typeLabel} — ${formatIstDate(date)}`,
    SHELL(`
      <h2 style="color: #3b82f6; margin-bottom: 4px;">${esc(typeLabel)}</h2>
      <p style="color: #374151; line-height: 1.6; margin-top: 0;">
        <strong>${esc(formatIstDate(date))}</strong>
      </p>
      ${reason ? `<p style="color: #6b7280; font-size: 14px;">Reason: ${esc(reason)}</p>` : ""}
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
        <p style="color: #1e40af; margin: 0; font-size: 14px;">${esc(scheduleNote)}</p>
      </div>
      ${FOOTNOTE(footnote)}
    `),
    `day-off notification for ${date}`
  );
}
