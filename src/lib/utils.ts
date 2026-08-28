import { toZonedTime } from "date-fns-tz";
import { format, isWeekend } from "date-fns";

const IST = "Asia/Kolkata";

export function nowIST(): Date {
  return toZonedTime(new Date(), IST);
}

export function todayIST(): string {
  return format(nowIST(), "yyyy-MM-dd");
}

export function isWeekendIST(): boolean {
  return isWeekend(nowIST());
}

/**
 * UTC instants bounding an IST calendar day.
 *
 * Log timestamps are stored as absolute `Date`s, so filtering "2026-08-28" has
 * to translate that IST day into the UTC window it actually occupies —
 * 2026-08-27T18:30Z .. 2026-08-28T18:29:59.999Z. Comparing against
 * `${date}T00:00:00.000Z` instead silently drops every evening check-out and
 * pulls in the previous evening's. Works on existing records unchanged: the
 * stored value is the same instant either way, only the boundaries move.
 */
export function istDayRangeUtc(date: string): { start: Date; end: Date } {
  return {
    start: new Date(`${date}T00:00:00.000+05:30`),
    end: new Date(`${date}T23:59:59.999+05:30`),
  };
}

/** True for a well-formed "YYYY-MM-DD" that names a real calendar date. */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** True for a well-formed 24-hour "HH:mm". */
export function isValidTimeString(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Clamp a user-supplied pagination value, falling back on NaN. */
export function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = parseInt(raw ?? "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function randomDelay(maxMinutes: number): number {
  return Math.floor(Math.random() * maxMinutes * 60 * 1000);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
