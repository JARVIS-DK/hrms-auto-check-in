import { getDb } from "../db";

export interface IPasswordReset {
  email: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
}

export async function getPasswordResetCollection() {
  const db = await getDb();
  return db.collection<IPasswordReset>("password_resets");
}

export async function createOtp(email: string): Promise<string> {
  const col = await getPasswordResetCollection();
  const normalizedEmail = email.toLowerCase().trim();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await col.deleteMany({ email: normalizedEmail });
  await col.insertOne({ email: normalizedEmail, otp, expiresAt, attempts: 0 });
  return otp;
}

export async function verifyOtp(
  email: string,
  otp: string
): Promise<{ valid: boolean; reason?: string }> {
  const col = await getPasswordResetCollection();
  const normalizedEmail = email.toLowerCase().trim();
  const record = await col.findOne({ email: normalizedEmail });

  if (!record) return { valid: false, reason: "No OTP requested" };
  if (record.expiresAt < new Date()) return { valid: false, reason: "OTP expired" };
  if (record.attempts >= 5) return { valid: false, reason: "Too many attempts" };

  if (record.otp !== otp) {
    await col.updateOne({ email: normalizedEmail }, { $inc: { attempts: 1 } });
    return { valid: false, reason: "Invalid OTP" };
  }

  await col.deleteMany({ email: normalizedEmail });
  return { valid: true };
}
