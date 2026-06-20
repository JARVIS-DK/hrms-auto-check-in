import dns from "dns";
import nodemailer from "nodemailer";

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

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

export async function sendFailureEmail(
  to: string,
  action: "CHECK_IN" | "CHECK_OUT",
  errorMessage: string
) {
  const actionLabel = action === "CHECK_IN" ? "Check-in" : "Check-out";
  const time = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject: `[HRMS] ${actionLabel} Failed`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #ef4444; margin-bottom: 16px;">${actionLabel} Failed</h2>
          <p style="color: #374151; line-height: 1.6;">
            Your automated ${actionLabel.toLowerCase()} failed at <strong>${time}</strong>.
          </p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
            <p style="color: #991b1b; margin: 0; font-size: 14px;"><strong>Error:</strong> ${errorMessage}</p>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            Please check your HRMS credentials or try a manual check-in from the dashboard.
          </p>
        </div>
      `,
    });
    console.log(`[MAIL] Failure notification sent to ${to} for ${action}`);
  } catch (err) {
    console.error(`[MAIL] Failed to send email to ${to}:`, err);
  }
}

export async function sendOtpEmail(to: string, otp: string) {
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject: `[HRMS] Password Reset OTP`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #3b82f6; margin-bottom: 16px;">Password Reset</h2>
          <p style="color: #374151; line-height: 1.6;">
            Your OTP for password reset is:
          </p>
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e40af;">${otp}</span>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            This OTP is valid for 10 minutes. Do not share it with anyone.
          </p>
        </div>
      `,
    });
    console.log(`[MAIL] OTP sent to ${to}`);
  } catch (err) {
    console.error(`[MAIL] Failed to send OTP to ${to}:`, err);
  }
}

export async function sendLeaveNotificationEmail(
  to: string,
  date: string,
  reason?: string
) {
  const formattedDate = new Date(date + "T00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject: `[HRMS] On Leave Today — No Check-in/Out`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #3b82f6; margin-bottom: 16px;">Leave Day — Scheduler Paused</h2>
          <p style="color: #374151; line-height: 1.6;">
            You are on leave today, <strong>${formattedDate}</strong>.
          </p>
          ${reason ? `<p style="color: #6b7280; font-size: 14px;">Reason: ${reason}</p>` : ""}
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
            <p style="color: #1e40af; margin: 0; font-size: 14px;">
              The auto scheduler will not perform check-in or check-out today.
            </p>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            If this is incorrect, remove the leave date from your dashboard settings.
          </p>
        </div>
      `,
    });
    console.log(`[MAIL] Leave notification sent to ${to} for ${date}`);
  } catch (err) {
    console.error(`[MAIL] Failed to send leave email to ${to}:`, err);
  }
}
