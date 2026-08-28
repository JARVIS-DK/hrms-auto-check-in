import type { ISettings } from "./models/settings";
import type { GlobalDefaults } from "./models/global-settings";
import { leaveTypeOf, type ILeave } from "./models/leave";

export type JobKind = "checkin" | "checkout";

export interface Window {
  start: string;
  end: string;
}

/**
 * The window a user's action falls in for the day, or null when the day is off.
 *
 * Half-day leave shifts the window rather than skipping: a first-half leave
 * means arriving at midday, so check-in moves to the half-day arrival window
 * while check-out stays put — and the mirror image for a second-half leave.
 *
 * The shifted window resolves in order of specificity: times set on the leave
 * itself, then the user's half-day setting, then the global default.
 *
 * Lives here rather than in cron/attendance.ts so /api/today can share it
 * without bundling the mailer and HRMS client into that route.
 */
export function resolveWindow(
  kind: JobKind,
  user: ISettings,
  defaults: GlobalDefaults,
  leave: Pick<ILeave, "type" | "windowStart" | "windowEnd"> | null
): Window | null {
  const leaveType = leave ? leaveTypeOf(leave) : null;
  if (leaveType === "full") return null;

  const pick = (userStart?: string, userEnd?: string, dStart?: string, dEnd?: string): Window => ({
    start: userStart || dStart!,
    end: userEnd || dEnd!,
  });

  const normal =
    kind === "checkin"
      ? pick(user.checkinStart, user.checkinEnd, defaults.checkinStart, defaults.checkinEnd)
      : pick(user.checkoutStart, user.checkoutEnd, defaults.checkoutStart, defaults.checkoutEnd);

  if (leaveType === null) return normal;

  const shifted =
    leave?.windowStart && leave?.windowEnd
      ? { start: leave.windowStart, end: leave.windowEnd }
      : kind === "checkin"
        ? pick(
            user.halfDayCheckinStart,
            user.halfDayCheckinEnd,
            defaults.halfDayCheckinStart,
            defaults.halfDayCheckinEnd
          )
        : pick(
            user.halfDayCheckoutStart,
            user.halfDayCheckoutEnd,
            defaults.halfDayCheckoutStart,
            defaults.halfDayCheckoutEnd
          );

  // first_half  -> late arrival, normal departure
  // second_half -> normal arrival, early departure
  if (leaveType === "first_half") return kind === "checkin" ? shifted : normal;
  return kind === "checkin" ? normal : shifted;
}

/** A random "HH:mm" inside the window; the start when the window is degenerate. */
export function randomTimeInRange(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) return start;
  const randomMin = startMin + Math.floor(Math.random() * (endMin - startMin));
  const h = Math.floor(randomMin / 60)
    .toString()
    .padStart(2, "0");
  const m = (randomMin % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
