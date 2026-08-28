import { getSettingsCollection, type ISettings } from "@/lib/models/settings";
import { getLeavesCollection, leaveTypeOf, type ILeave } from "@/lib/models/leave";
import { findHoliday, type IHoliday } from "@/lib/models/holiday";
import {
  getScheduledActionsCollection,
  type IScheduledAction,
} from "@/lib/models/scheduled-action";
import { insertLog } from "@/lib/models/log";
import { getGlobalDefaults, type GlobalDefaults } from "@/lib/models/global-settings";
import { decrypt } from "@/lib/crypto";
import { hrmsLogin, hrmsGetState, hrmsCheckin } from "@/lib/hrms/client";
import { sendFailureEmail, sendSkipEmail, sendLeaveNotificationEmail } from "@/lib/mail";
import { resolveWindow, randomTimeInRange, type JobKind } from "@/lib/schedule";
import { todayIST, nowIST } from "@/lib/utils";
import { format, getDay } from "date-fns";

interface JobSpec {
  kind: JobKind;
  tag: string;
  logType: "IN" | "OUT";
  logAction: "CHECK_IN" | "CHECK_OUT";
}

const SPECS: Record<JobKind, JobSpec> = {
  checkin: { kind: "checkin", tag: "CHECKIN", logType: "IN", logAction: "CHECK_IN" },
  checkout: { kind: "checkout", tag: "CHECKOUT", logType: "OUT", logAction: "CHECK_OUT" },
};

/** How many users may be mid-HRMS-conversation at once. */
const CONCURRENCY = 4;

const DUPLICATE_KEY = 11000;

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === DUPLICATE_KEY;
}

/**
 * Take exclusive ownership of one action for the day.
 *
 * Returns false when another cron tick already claimed it. cron-job.org fires
 * every 60s and a slow tick can outlive its own interval, so read-then-write
 * would let two overlapping invocations both decide the action is pending and
 * punch the clock twice. The flip has to be one atomic operation.
 */
async function claim(
  scheduled: Awaited<ReturnType<typeof getScheduledActionsCollection>>,
  userId: number,
  date: string,
  action: IScheduledAction["action"],
  result?: IScheduledAction["result"]
): Promise<boolean> {
  const claimed = await scheduled.findOneAndUpdate(
    { userId, date, action, executed: false },
    { $set: result ? { executed: true, result } : { executed: true } }
  );
  return claimed !== null;
}

/** Idempotently create the day's row, returning whatever ended up stored. */
async function ensureRow(
  scheduled: Awaited<ReturnType<typeof getScheduledActionsCollection>>,
  userId: number,
  date: string,
  action: IScheduledAction["action"],
  targetTime: string
): Promise<IScheduledAction | null> {
  try {
    await scheduled.updateOne(
      { userId, date, action },
      { $setOnInsert: { userId, date, action, targetTime, executed: false } },
      { upsert: true }
    );
  } catch (err) {
    // Lost an insert race against a concurrent tick — the row it wrote is
    // authoritative, so fall through and read it.
    if (!isDuplicateKey(err)) throw err;
  }
  return scheduled.findOne({ userId, date, action });
}

interface DueWork {
  user: ISettings;
  spec: JobSpec;
}

/**
 * One tick: decide what is due across all users, then execute it.
 *
 * Reads are batched up front (two queries total rather than two per user per
 * job) and the HRMS work runs with bounded concurrency, so the tick finishes
 * well inside the 60s function budget as the user count grows.
 */
export async function runAttendanceTick(): Promise<{ due: number; users: number }> {
  const today = todayIST();
  const now = nowIST();
  const currentTime = format(now, "HH:mm");
  const dayOfWeek = getDay(now); // 0=Sun, 6=Sat

  const [defaults, settings, scheduled, leavesCol, holiday] = await Promise.all([
    getGlobalDefaults(),
    getSettingsCollection(),
    getScheduledActionsCollection(),
    getLeavesCollection(),
    findHoliday(today),
  ]);

  const activeUsers = await settings.find({ automationEnabled: true }).toArray();
  if (activeUsers.length === 0) {
    console.log(`[TICK ${currentTime}] no active users`);
    return { due: 0, users: 0 };
  }

  const userIds = activeUsers.map((u) => u.userId);

  // Both lookups batched into one query each. Doing them per user per action
  // meant four round-trips per user every minute, all day, even at 3am.
  const [leaveDocs, scheduledDocs] = await Promise.all([
    leavesCol.find({ userId: { $in: userIds }, date: today }).toArray(),
    scheduled.find({ userId: { $in: userIds }, date: today }).toArray(),
  ]);

  const leaveByUser = new Map<number, ILeave>(leaveDocs.map((l) => [l.userId, l]));
  const rowKey = (userId: number, action: string) => `${userId}:${action}`;
  const rows = new Map<string, IScheduledAction>(
    scheduledDocs.map((r) => [rowKey(r.userId, r.action), r])
  );

  const work: DueWork[] = [];

  for (const user of activeUsers) {
    if (dayOfWeek === 6 && (user.skipSaturday ?? true)) continue;
    if (dayOfWeek === 0 && (user.skipSunday ?? true)) continue;

    // A public holiday closes the office for everyone, so it outranks whatever
    // the user has on their own calendar — including a half day.
    const leave = holiday ? null : (leaveByUser.get(user.userId) ?? null);

    if ((holiday || leave) && !rows.get(rowKey(user.userId, "leave_notify"))?.executed) {
      await notifyDayOffOnce(scheduled, user, today, holiday, leave, defaults);
    }

    for (const spec of Object.values(SPECS)) {
      const existing = rows.get(rowKey(user.userId, spec.kind)) ?? null;
      if (
        await isDue(spec, user, defaults, leave, holiday, today, currentTime, scheduled, existing)
      ) {
        work.push({ user, spec });
      }
    }
  }

  if (work.length > 0) {
    console.log(`[TICK ${currentTime}] ${work.length} action(s) due across ${activeUsers.length} user(s)`);
    await runWithConcurrency(work, CONCURRENCY, (item) =>
      execute(item.spec, item.user, today, scheduled)
    );
  }

  return { due: work.length, users: activeUsers.length };
}

/**
 * Decide whether this user's action should fire now, recording missed/on-leave
 * outcomes along the way. Returns true only when the HRMS call should happen.
 */
async function isDue(
  spec: JobSpec,
  user: ISettings,
  defaults: GlobalDefaults,
  leave: ILeave | null,
  holiday: IHoliday | null,
  today: string,
  currentTime: string,
  scheduled: Awaited<ReturnType<typeof getScheduledActionsCollection>>,
  existing: IScheduledAction | null
): Promise<boolean> {
  // Already settled today — no reads, no writes, no duplicate log rows.
  if (existing?.executed) return false;

  const window = holiday ? null : resolveWindow(spec.kind, user, defaults, leave);

  // Day off: nothing to do, but close out the row so the admin view shows why
  // rather than leaving it permanently pending.
  if (!window) {
    const reason = holiday ? `public holiday: ${holiday.name}` : "on leave";
    await ensureRow(scheduled, user.userId, today, spec.kind, "00:00");
    // Only log if this tick is the one that closed the row — otherwise a day
    // off would accumulate a SKIPPED entry every single minute.
    if (
      await claim(scheduled, user.userId, today, spec.kind, holiday ? "holiday" : "on_leave")
    ) {
      await insertLog({
        userId: user.userId,
        action: spec.logAction,
        status: "SKIPPED",
        scheduledAt: new Date(),
        executedAt: new Date(),
        skipReason: reason,
      });
    }
    return false;
  }

  if (currentTime < window.start) return false;

  if (currentTime > window.end) {
    await ensureRow(scheduled, user.userId, today, spec.kind, window.end);
    await claim(scheduled, user.userId, today, spec.kind, "missed");
    return false;
  }

  // Inside the window: make sure today's random target time exists, then see
  // whether the clock has reached it.
  const row =
    existing ??
    (await ensureRow(
      scheduled,
      user.userId,
      today,
      spec.kind,
      randomTimeInRange(window.start, window.end)
    ));
  if (!row || row.executed) return false;

  return currentTime >= row.targetTime;
}

/** Exactly one day-off email per user per day, regardless of how many jobs run. */
async function notifyDayOffOnce(
  scheduled: Awaited<ReturnType<typeof getScheduledActionsCollection>>,
  user: ISettings,
  today: string,
  holiday: IHoliday | null,
  leave: ILeave | null,
  defaults: GlobalDefaults
): Promise<void> {
  // The claim is what makes this once-per-day: the loser of a race, and every
  // later tick, exits here rather than sending a second email.
  const row = await ensureRow(scheduled, user.userId, today, "leave_notify", "00:00");
  if (!row || row.executed) return;
  if (!(await claim(scheduled, user.userId, today, "leave_notify", "success"))) return;

  if (holiday) {
    await sendLeaveNotificationEmail(
      user.hrmsEmail,
      today,
      undefined,
      `Public holiday — ${holiday.name}`,
      "The office is closed today, so the auto scheduler will not check you in or out.",
      "This is a company-wide holiday. You don't need to book leave for it."
    );
    return;
  }
  if (!leave) return;

  const leaveType = leaveTypeOf(leave);
  const checkin = resolveWindow("checkin", user, defaults, leave);
  const checkout = resolveWindow("checkout", user, defaults, leave);

  // Matches the wording on the Leaves page so the email doesn't introduce a
  // second vocabulary for the same thing.
  const label =
    leaveType === "full"
      ? "Off all day"
      : leaveType === "first_half"
        ? "Morning off"
        : "Afternoon off";

  const note =
    leaveType === "full"
      ? "The auto scheduler will not check you in or out today."
      : `You'll be checked in between ${checkin!.start} and ${checkin!.end}, ` +
        `and checked out between ${checkout!.start} and ${checkout!.end}.`;

  await sendLeaveNotificationEmail(user.hrmsEmail, today, leave.reason, label, note);
}

async function execute(
  spec: JobSpec,
  user: ISettings,
  today: string,
  scheduled: Awaited<ReturnType<typeof getScheduledActionsCollection>>
): Promise<void> {
  // Claim before touching HRMS. If this returns false another tick beat us here.
  if (!(await claim(scheduled, user.userId, today, spec.kind))) return;

  const who = `user#${user.userId}`;
  const setResult = (result: IScheduledAction["result"]) =>
    scheduled.updateOne({ userId: user.userId, date: today, action: spec.kind }, { $set: { result } });

  try {
    const password = decrypt(user.hrmsPasswordEncrypted, user.hrmsPasswordIv, user.hrmsPasswordTag);
    const session = await hrmsLogin(user.hrmsEmail, password);
    const state = await hrmsGetState(session);

    const already = state.checkins.some((c) => c.log_type === spec.logType);
    if (already) {
      const detail =
        spec.kind === "checkin"
          ? "You were already checked in today — most likely you did it manually."
          : "You were already checked out today — most likely you did it manually.";
      await setResult("skipped");
      await insertLog({
        userId: user.userId,
        action: spec.logAction,
        status: "SKIPPED",
        scheduledAt: new Date(),
        executedAt: new Date(),
        skipReason: `already ${spec.kind === "checkin" ? "checked in" : "checked out"}`,
      });
      await sendSkipEmail(user.hrmsEmail, spec.logAction, detail);
      console.log(`[${spec.tag}] ${who} — skipped (already ${spec.logType})`);
      return;
    }

    if (spec.kind === "checkout" && !state.checkins.some((c) => c.log_type === "IN")) {
      await setResult("skipped");
      await insertLog({
        userId: user.userId,
        action: spec.logAction,
        status: "SKIPPED",
        scheduledAt: new Date(),
        executedAt: new Date(),
        skipReason: "never checked in today",
      });
      await sendSkipEmail(
        user.hrmsEmail,
        spec.logAction,
        "No check-in was recorded today, so there is nothing to check out from."
      );
      console.log(`[${spec.tag}] ${who} — skipped (no check-in today)`);
      return;
    }

    const result = await hrmsCheckin(session, user.latitude, user.longitude, spec.logType);
    await setResult(result.success ? "success" : "failed");
    await insertLog({
      userId: user.userId,
      action: spec.logAction,
      status: result.success ? "SUCCESS" : "FAILED",
      scheduledAt: new Date(),
      executedAt: new Date(),
      responseData: result.raw as Record<string, unknown>,
      errorMessage: result.success ? undefined : "HRMS returned failure",
    });

    if (!result.success) {
      await sendFailureEmail(user.hrmsEmail, spec.logAction, "HRMS returned failure");
    }
    console.log(`[${spec.tag}] ${who} — ${result.success ? "SUCCESS" : "FAILED"}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await setResult("failed");
    await insertLog({
      userId: user.userId,
      action: spec.logAction,
      status: "FAILED",
      scheduledAt: new Date(),
      executedAt: new Date(),
      errorMessage: message,
    });
    await sendFailureEmail(user.hrmsEmail, spec.logAction, message);
    console.error(`[${spec.tag}] ${who} — ERROR: ${message}`);
  }
}

/** One slow user must not stall the rest, and one failure must not abort the batch. */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        await fn(item);
      } catch (err) {
        console.error("[TICK] unhandled worker error:", err);
      }
    }
  });
  await Promise.all(workers);
}
