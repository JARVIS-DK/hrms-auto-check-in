import { randomBytes } from "crypto";
import { getDb } from "../db";
import { normalizeEmail } from "../account";

export interface IPasswordReset {
  email: string;
  token: string;
  expiresAt: Date;
  used: boolean;
}

export async function getPasswordResetCollection() {
  const db = await getDb();
  return db.collection<IPasswordReset>("password_resets");
}

export async function createResetToken(email: string): Promise<string> {
  const col = await getPasswordResetCollection();
  const normalizedEmail = normalizeEmail(email);
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await col.deleteMany({ email: normalizedEmail });
  await col.insertOne({ email: normalizedEmail, token, expiresAt, used: false });
  return token;
}

export async function verifyResetToken(
  token: string
): Promise<{ valid: boolean; email?: string; reason?: string }> {
  const col = await getPasswordResetCollection();
  const record = await col.findOne({ token, used: false });

  if (!record) return { valid: false, reason: "Invalid or expired reset link" };
  if (record.expiresAt < new Date()) return { valid: false, reason: "Reset link has expired" };

  return { valid: true, email: record.email };
}

export async function markTokenUsed(token: string) {
  const col = await getPasswordResetCollection();
  await col.updateOne({ token }, { $set: { used: true } });
}
