import { getSettingsCollection } from "@/lib/models/settings";
import { getLeavesCollection } from "@/lib/models/leave";
import { getScheduledActionsCollection } from "@/lib/models/scheduled-action";
import { insertLog } from "@/lib/models/log";
import { getGlobalDefaults } from "@/lib/models/global-settings";
import { decrypt } from "@/lib/crypto";
import { hrmsLogin, hrmsGetState, hrmsCheckin } from "@/lib/hrms/client";
import { sendFailureEmail, sendLeaveNotificationEmail } from "@/lib/mail";
import { todayIST, nowIST } from "@/lib/utils";
import { format, getDay } from "date-fns";

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
  console.log("[CHECKOUT] ===== Starting checkout job =====");
  const today = todayIST();
  const currentTime = format(nowIST(), "HH:mm");
  console.log(`[CHECKOUT] Today: ${today}, Current time: ${currentTime}`);

  const globalDefaults = await getGlobalDefaults();

  const settings = await getSettingsCollection();
  const activeUsers = await settings.find({ automationEnabled: true }).toArray();
  console.log(`[CHECKOUT] Found ${activeUsers.length} active users`);
  const scheduled = await getScheduledActionsCollection();

  const dayOfWeek = getDay(nowIST()); // 0=Sun, 6=Sat
  console.log(`[CHECKOUT] Day of week: ${dayOfWeek} (0=Sun, 6=Sat)`)

  for (const user of activeUsers) {
    console.log(`[CHECKOUT] Processing user: ${user.hrmsEmail}`);

    // Skip Saturday/Sunday per user setting
    if (dayOfWeek === 6 && (user.skipSaturday ?? true)) {
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — skipped (Saturday)`);
      continue;
    }
    if (dayOfWeek === 0 && (user.skipSunday ?? true)) {
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — skipped (Sunday)`);
      continue;
    }

    const start = user.checkoutStart || globalDefaults.checkoutStart;
    const end = user.checkoutEnd || globalDefaults.checkoutEnd;
    console.log(`[CHECKOUT] User ${user.hrmsEmail} — window: ${start} - ${end}`);

    // Not yet in the window
    if (currentTime < start) {
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — not yet in window (current: ${currentTime} < start: ${start})`);
      continue;
    }

    // Check existing scheduled action for today
    const existing = await scheduled.findOne({
      userId: user.userId,
      date: today,
      action: "checkout",
    });
    console.log(`[CHECKOUT] User ${user.hrmsEmail} — existing scheduled action: ${existing ? `found (executed: ${existing.executed}, targetTime: ${existing.targetTime})` : 'none'}`);

    // Already executed today
    if (existing?.executed) {
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — already executed today`);
      continue;
    }

    // Check leave early — skip before scheduling
    const leaves = await getLeavesCollection();
    const onLeave = await leaves.findOne({ userId: user.userId, date: today });
    console.log(`[CHECKOUT] User ${user.hrmsEmail} — leave check: ${onLeave ? `on leave (${onLeave.reason})` : 'not on leave'}`);
    if (onLeave) {
      await scheduled.updateOne(
        { userId: user.userId, date: today, action: "checkout" },
        { $set: { targetTime: start, executed: true, result: "on_leave" } },
        { upsert: true }
      );
      await insertLog({
        userId: user.userId,
        action: "CHECK_OUT",
        status: "SKIPPED",
        scheduledAt: new Date(),
        executedAt: new Date(),
        skipReason: "on leave",
      });
      await sendLeaveNotificationEmail(user.hrmsEmail, today, onLeave.reason);
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — on leave, notified`);
      continue;
    }

    // Past the window — mark as missed
    if (currentTime > end) {
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — past window (current: ${currentTime} > end: ${end}), marking as missed`);
      if (!existing) {
        await scheduled.updateOne(
          { userId: user.userId, date: today, action: "checkout" },
          { $set: { targetTime: end, executed: true, result: "missed" } },
          { upsert: true }
        );
      } else {
        await scheduled.updateOne(
          { _id: existing._id },
          { $set: { executed: true, result: "missed" } }
        );
      }
      continue;
    }

    // Assign a random target time once per day
    let targetTime: string;
    if (!existing) {
      targetTime = getRandomTimeInRange(start, end);
      await scheduled.insertOne({
        userId: user.userId,
        date: today,
        action: "checkout",
        targetTime,
        executed: false,
      });
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — scheduled at ${targetTime}`);
    } else {
      targetTime = existing.targetTime;
    }

    // Not yet time
    if (currentTime < targetTime) {
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — not yet time (current: ${currentTime} < target: ${targetTime})`);
      continue;
    }

    console.log(`[CHECKOUT] User ${user.hrmsEmail} — executing checkout now (current: ${currentTime}, target: ${targetTime})`);

    // Mark as executed (result will be updated below)
    await scheduled.updateOne(
      { userId: user.userId, date: today, action: "checkout" },
      { $set: { executed: true } }
    );

    try {
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — decrypting password`);
      const password = decrypt(
        user.hrmsPasswordEncrypted,
        user.hrmsPasswordIv,
        user.hrmsPasswordTag
      );

      console.log(`[CHECKOUT] User ${user.hrmsEmail} — logging into HRMS`);
      const session = await hrmsLogin(user.hrmsEmail, password);
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — fetching current state`);
      const state = await hrmsGetState(session);
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — current checkins: ${JSON.stringify(state.checkins)}`);

      if (state.checkins.some((c) => c.log_type === "OUT")) {
        await scheduled.updateOne(
          { userId: user.userId, date: today, action: "checkout" },
          { $set: { result: "skipped" } }
        );
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
        await scheduled.updateOne(
          { userId: user.userId, date: today, action: "checkout" },
          { $set: { result: "skipped" } }
        );
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

      console.log(`[CHECKOUT] User ${user.hrmsEmail} — calling hrmsCheckin with lat: ${user.latitude}, lng: ${user.longitude}`);
      const result = await hrmsCheckin(session, user.latitude, user.longitude, "OUT");
      console.log(`[CHECKOUT] User ${user.hrmsEmail} — hrmsCheckin result: ${JSON.stringify(result)}`);

      await scheduled.updateOne(
        { userId: user.userId, date: today, action: "checkout" },
        { $set: { result: result.success ? "success" : "failed" } }
      );

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
      console.error(`[CHECKOUT] User ${user.hrmsEmail} — caught exception: ${message}`);
      console.error(`[CHECKOUT] User ${user.hrmsEmail} — stack trace:`, err);
      await scheduled.updateOne(
        { userId: user.userId, date: today, action: "checkout" },
        { $set: { result: "failed" } }
      );
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

  console.log("[CHECKOUT] ===== Checkout job completed =====");
}
