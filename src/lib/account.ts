import bcrypt from "bcryptjs";
import type { IUser } from "./models/user";
import { getUsersCollection } from "./models/user";
// Shared with the index definitions so lookups and the unique index agree on
// what "the same email" means.
import { EMAIL_COLLATION as CI } from "./models/index-specs";

/** One bcrypt cost for the whole app — register and reset must not diverge. */
export const BCRYPT_ROUNDS = 12;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/**
 * Returns an error message, or null when the password is acceptable.
 * Single source of truth: registration, reset, and any future change-password
 * flow all call this so the rules can't drift apart again.
 */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "Password must contain at least one letter and one number";
  }
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Look up by email case-insensitively.
 *
 * New accounts are stored lowercased, but accounts created before
 * normalization kept whatever casing was typed. The collation makes both
 * resolve, so existing users keep working without a data migration.
 */
export async function findUserByEmail(email: string): Promise<IUser | null> {
  const users = await getUsersCollection();
  return users.findOne({ email: normalizeEmail(email) }, { collation: CI });
}

export async function emailIsTaken(email: string): Promise<boolean> {
  const users = await getUsersCollection();
  const hit = await users.findOne(
    { email: normalizeEmail(email) },
    { collation: CI, projection: { _id: 1 } }
  );
  return hit !== null;
}

export { CI as EMAIL_COLLATION };
