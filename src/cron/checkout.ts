import { getSettingsCollection } from "@/lib/models/settings";
import { getLeavesCollection } from "@/lib/models/leave";
import { insertLog } from "@/lib/models/log";
import { decrypt } from "@/lib/crypto";
import { hrmsLogin, hrmsGetState, hrmsCheckin } from "@/lib/hrms/client";
import { sendFailureEmail } from "@/lib/mail";
import { todayIST, nowIST } from "@/lib/utils";
import { format, getDay } from "date-fns";

const DEFAULT_START = "18:00";
const DEFAULT_END = "18:45";

// Track scheduled times per user per day so we only execute once
const scheduledTimes = new Map<string, string>(); // "userId:date" -> "HH:MM"
const executed = new Set<string>(); // "userId:date"

function getRandomTimeInRange(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) return start;
  const randomMin = startMin + Math.floor(Math.random() * (endMin - startMin));
  const h = Math.floor(randomMin / 60).toString().padStart(2, "0");
  const m = (randomMin % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export async function runCheckoutJob() {

  const today = todayIST();
  const currentTime = format(nowIST(), "HH:mm");

  const settings = await getSettingsCollection();
  const activeUsers = await settings.find({ automationEnabled: true }).toArray();

  const dayOfWeek = getDay(nowIST()); // 0=Sun, 6=Sat

  for (const user of activeUsers) {
    const key = `${user.userId}:${today}:checkout`;

    // Already executed today
    if (executed.has(key)) continue;

    // Skip Saturday/Sunday per user setting
    if (dayOfWeek === 6 && (user.skipSaturday ?? true)) continue;
    if (dayOfWeek === 0 && (user.skipSunday ?? true)) continue;

    const start = user.checkoutStart || DEFAULT_START;
    const end = user.checkoutEnd || DEFAULT_END;

    // Not yet in the window
    if (currentTime < start) continue;

    // Past the window — mark as missed
    if (currentTime > end) {
      executed.add(key);
      continue;
    }

    // Assign a random target time once per day
    if (!scheduledTimes.has(key)) {
      scheduledTimes.set(key, getRandomTimeInRange(start, end));
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — scheduled at ${scheduledTimes.get(key)}`);
    }

    const targetTime = scheduledTimes.get(key)!;

    // Not yet time
    if (currentTime < targetTime) continue;

    // Time to execute
    executed.add(key);
    scheduledTimes.delete(key);

    const leaves = await getLeavesCollection();

    const onLeave = await leaves.findOne({ userId: user.userId, date: today });
    if (onLeave) {
      await insertLog({
        userId: user.userId,
        action: "CHECK_OUT",
        status: "SKIPPED",
        scheduledAt: new Date(),
        executedAt: new Date(),
        skipReason: "on leave",
      });
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — skipped (on leave)`);
      continue;
    }

    try {
      const password = decrypt(
        user.hrmsPasswordEncrypted,
        user.hrmsPasswordIv,
        user.hrmsPasswordTag
      );

      const session = await hrmsLogin(user.hrmsEmail, password);
      const state = await hrmsGetState(session);

      if (state.checkins.some((c) => c.log_type === "OUT")) {
        await insertLog({
          userId: user.userId,
          action: "CHECK_OUT",
          status: "SKIPPED",
          scheduledAt: new Date(),
          executedAt: new Date(),
          skipReason: "already checked out",
        });
        await sendFailureEmail(user.hrmsEmail, "CHECK_OUT", "Skipped — you already checked out today (possibly manual).");
        console.log(`[CHECKOUT] User ${user.hrmsEmail} — skipped (already out)`);
        continue;
      }

      if (!state.checkins.some((c) => c.log_type === "IN")) {
        await insertLog({
          userId: user.userId,
          action: "CHECK_OUT",
          status: "SKIPPED",
          scheduledAt: new Date(),
          executedAt: new Date(),
          skipReason: "never checked in today",
        });
        await sendFailureEmail(user.hrmsEmail, "CHECK_OUT", "Skipped — no check-in found today, cannot check out.");
        console.log(`[CHECKOUT] User ${user.hrmsEmail} — skipped (no check-in today)`);
        continue;
      }

      const result = await hrmsCheckin(session, user.latitude, user.longitude, "OUT");

      await insertLog({
        userId: user.userId,
        action: "CHECK_OUT",
        status: result.success ? "SUCCESS" : "FAILED",
        scheduledAt: new Date(),
        executedAt: new Date(),
        responseData: result.raw as Record<string, unknown>,
        errorMessage: result.success ? undefined : "HRMS returned failure",
      });

      if (!result.success) {
        await sendFailureEmail(user.hrmsEmail, "CHECK_OUT", "HRMS returned failure");
      }

      console.log(`[CHECKOUT] User ${user.hrmsEmail} — ${result.success ? "SUCCESS" : "FAILED"} at ${result.time}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await insertLog({
        userId: user.userId,
        action: "CHECK_OUT",
        status: "FAILED",
        scheduledAt: new Date(),
        executedAt: new Date(),
        errorMessage: message,
      });
      await sendFailureEmail(user.hrmsEmail, "CHECK_OUT", message);
      console.error(`[CHECKOUT] User ${user.hrmsEmail} — ERROR: ${message}`);
    }
  }
}
