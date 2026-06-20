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

export async function runCheckinJob() {
  console.log("[CHECKIN] ===== Starting checkin job =====");
  const today = todayIST();
  const currentTime = format(nowIST(), "HH:mm");
  console.log(`[CHECKIN] Today: ${today}, Current time: ${currentTime}`);

  const globalDefaults = await getGlobalDefaults();

  const settings = await getSettingsCollection();
  const activeUsers = await settings.find({ automationEnabled: true }).toArray();
  console.log(`[CHECKIN] Found ${activeUsers.length} active users`);
  const scheduled = await getScheduledActionsCollection();

  const dayOfWeek = getDay(nowIST()); // 0=Sun, 6=Sat
  console.log(`[CHECKIN] Day of week: ${dayOfWeek} (0=Sun, 6=Sat)`)

  for (const user of activeUsers) {
    console.log(`[CHECKIN] Processing user: ${user.hrmsEmail}`);

    // Skip Saturday/Sunday per user setting
    if (dayOfWeek === 6 && (user.skipSaturday ?? true)) {
      console.log(`[CHECKIN] User ${user.hrmsEmail} — skipped (Saturday)`);
      continue;
    }
    if (dayOfWeek === 0 && (user.skipSunday ?? true)) {
      console.log(`[CHECKIN] User ${user.hrmsEmail} — skipped (Sunday)`);
      continue;
    }

    const start = user.checkinStart || globalDefaults.checkinStart;
    const end = user.checkinEnd || globalDefaults.checkinEnd;
    console.log(`[CHECKIN] User ${user.hrmsEmail} — window: ${start} - ${end}`);

    // Not yet in the window
    if (currentTime < start) {
      console.log(`[CHECKIN] User ${user.hrmsEmail} — not yet in window (current: ${currentTime} < start: ${start})`);
      continue;
    }

    // Check existing scheduled action for today
    const existing = await scheduled.findOne({
      userId: user.userId,
      date: today,
      action: "checkin",
    });
    console.log(`[CHECKIN] User ${user.hrmsEmail} — existing scheduled action: ${existing ? `found (executed: ${existing.executed}, targetTime: ${existing.targetTime})` : 'none'}`);

    // Already executed today
    if (existing?.executed) {
      console.log(`[CHECKIN] User ${user.hrmsEmail} — already executed today`);
      continue;
    }

    // Check leave early — send notification and skip before scheduling
    const leaves = await getLeavesCollection();
    const onLeave = await leaves.findOne({ userId: user.userId, date: today });
    console.log(`[CHECKIN] User ${user.hrmsEmail} — leave check: ${onLeave ? `on leave (${onLeave.reason})` : 'not on leave'}`);
    if (onLeave) {
      await scheduled.updateOne(
        { userId: user.userId, date: today, action: "checkin" },
        { $set: { targetTime: start, executed: true, result: "on_leave" } },
        { upsert: true }
      );
      await insertLog({
        userId: user.userId,
        action: "CHECK_IN",
        status: "SKIPPED",
        scheduledAt: new Date(),
        executedAt: new Date(),
        skipReason: "on leave",
      });
      await sendLeaveNotificationEmail(user.hrmsEmail, today, onLeave.reason);
      console.log(`[CHECKIN] User ${user.hrmsEmail} — on leave, notified`);
      continue;
    }

    // Past the window — mark as missed
    if (currentTime > end) {
      console.log(`[CHECKIN] User ${user.hrmsEmail} — past window (current: ${currentTime} > end: ${end}), marking as missed`);
      if (!existing) {
        await scheduled.updateOne(
          { userId: user.userId, date: today, action: "checkin" },
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
        action: "checkin",
        targetTime,
        executed: false,
      });
      console.log(`[CHECKIN] User ${user.hrmsEmail} — scheduled at ${targetTime}`);
    } else {
      targetTime = existing.targetTime;
    }

    // Not yet time
    if (currentTime < targetTime) {
      console.log(`[CHECKIN] User ${user.hrmsEmail} — not yet time (current: ${currentTime} < target: ${targetTime})`);
      continue;
    }

    console.log(`[CHECKIN] User ${user.hrmsEmail} — executing checkin now (current: ${currentTime}, target: ${targetTime})`);

    // Mark as executed (result will be updated below)
    await scheduled.updateOne(
      { userId: user.userId, date: today, action: "checkin" },
      { $set: { executed: true } }
    );

    try {
      console.log(`[CHECKIN] User ${user.hrmsEmail} — decrypting password`);
      const password = decrypt(
        user.hrmsPasswordEncrypted,
        user.hrmsPasswordIv,
        user.hrmsPasswordTag
      );

      console.log(`[CHECKIN] User ${user.hrmsEmail} — logging into HRMS`);
      const session = await hrmsLogin(user.hrmsEmail, password);
      console.log(`[CHECKIN] User ${user.hrmsEmail} — fetching current state`);
      const state = await hrmsGetState(session);
      console.log(`[CHECKIN] User ${user.hrmsEmail} — current checkins: ${JSON.stringify(state.checkins)}`);

      if (state.checkins.some((c) => c.log_type === "IN")) {
        await scheduled.updateOne(
          { userId: user.userId, date: today, action: "checkin" },
          { $set: { result: "skipped" } }
        );
        await insertLog({
          userId: user.userId,
          action: "CHECK_IN",
          status: "SKIPPED",
          scheduledAt: new Date(),
          executedAt: new Date(),
          skipReason: "already checked in",
        });
        await sendFailureEmail(user.hrmsEmail, "CHECK_IN", "Skipped — you already checked in today (possibly manual).");
        console.log(`[CHECKIN] User ${user.hrmsEmail} — skipped (already in)`);
        continue;
      }

      console.log(`[CHECKIN] User ${user.hrmsEmail} — calling hrmsCheckin with lat: ${user.latitude}, lng: ${user.longitude}`);
      const result = await hrmsCheckin(session, user.latitude, user.longitude, "IN");
      console.log(`[CHECKIN] User ${user.hrmsEmail} — hrmsCheckin result: ${JSON.stringify(result)}`);

      await scheduled.updateOne(
        { userId: user.userId, date: today, action: "checkin" },
        { $set: { result: result.success ? "success" : "failed" } }
      );

      await insertLog({
        userId: user.userId,
        action: "CHECK_IN",
        status: result.success ? "SUCCESS" : "FAILED",
        scheduledAt: new Date(),
        executedAt: new Date(),
        responseData: result.raw as Record<string, unknown>,
        errorMessage: result.success ? undefined : "HRMS returned failure",
      });

      if (!result.success) {
        await sendFailureEmail(user.hrmsEmail, "CHECK_IN", "HRMS returned failure");
      }

      console.log(`[CHECKIN] User ${user.hrmsEmail} — ${result.success ? "SUCCESS" : "FAILED"} at ${result.time}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[CHECKIN] User ${user.hrmsEmail} — caught exception: ${message}`);
      console.error(`[CHECKIN] User ${user.hrmsEmail} — stack trace:`, err);
      await scheduled.updateOne(
        { userId: user.userId, date: today, action: "checkin" },
        { $set: { result: "failed" } }
      );
      await insertLog({
        userId: user.userId,
        action: "CHECK_IN",
        status: "FAILED",
        scheduledAt: new Date(),
        executedAt: new Date(),
        errorMessage: message,
      });
      await sendFailureEmail(user.hrmsEmail, "CHECK_IN", message);
      console.error(`[CHECKIN] User ${user.hrmsEmail} — ERROR: ${message}`);
    }
  }

  console.log("[CHECKIN] ===== Checkin job completed =====");
}
