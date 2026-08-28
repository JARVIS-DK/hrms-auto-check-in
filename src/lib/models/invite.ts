import { randomBytes } from "crypto";
import { getDb } from "../db";
import { normalizeEmail, EMAIL_COLLATION } from "../account";

export const INVITE_TTL_DAYS = 7;

export interface IInvite {
  token: string;
  /** Registration is locked to this address — the token cannot enroll anyone else. */
  email: string;
  invitedBy: number;
  invitedByName: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
  revokedAt?: Date;
}

export type InviteStatus = "pending" | "used" | "revoked" | "expired";

export function inviteStatus(invite: IInvite, now = new Date()): InviteStatus {
  if (invite.usedAt) return "used";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt < now) return "expired";
  return "pending";
}

export async function getInvitesCollection() {
  const db = await getDb();
  return db.collection<IInvite>("invites");
}

export async function createInvite(
  email: string,
  invitedBy: number,
  invitedByName: string
): Promise<IInvite> {
  const col = await getInvitesCollection();
  const normalizedEmail = normalizeEmail(email);

  // Supersede any outstanding invite for this address so a resend doesn't
  // leave two live links pointing at the same account.
  await col.updateMany(
    { email: normalizedEmail, usedAt: { $exists: false }, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
    { collation: EMAIL_COLLATION }
  );

  const invite: IInvite = {
    token: randomBytes(32).toString("hex"),
    email: normalizedEmail,
    invitedBy,
    invitedByName,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  };

  await col.insertOne(invite);
  return invite;
}

/**
 * Resolve a token to the address it authorizes.
 * Deliberately returns one opaque reason for every failure mode so a stranger
 * probing tokens learns nothing about which ones exist.
 */
export async function verifyInvite(
  token: unknown
): Promise<{ valid: true; email: string } | { valid: false; reason: string }> {
  const INVALID = { valid: false, reason: "This invite link is invalid or has expired" } as const;
  if (typeof token !== "string" || token.length === 0) return INVALID;

  const col = await getInvitesCollection();
  const invite = await col.findOne({ token });
  if (!invite || inviteStatus(invite) !== "pending") return INVALID;

  return { valid: true, email: invite.email };
}

/**
 * Atomically burn a single-use token. Returns false when another registration
 * already consumed it, which is what makes the invite genuinely single-use
 * under concurrent submits.
 */
export async function consumeInvite(token: string): Promise<boolean> {
  const col = await getInvitesCollection();
  const claimed = await col.findOneAndUpdate(
    {
      token,
      usedAt: { $exists: false },
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } }
  );
  return claimed !== null;
}

export async function revokeInvite(token: string): Promise<boolean> {
  const col = await getInvitesCollection();
  const result = await col.updateOne(
    { token, usedAt: { $exists: false }, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
  return result.modifiedCount > 0;
}
