import { getSettingsCollection } from "@/lib/models/settings";
import { getLeavesCollection } from "@/lib/models/leave";
import { getScheduledActionsCollection } from "@/lib/models/scheduled-action";
import { sendLeaveNotificationEmail } from "@/lib/mail";
import { todayIST, nowIST } from "@/lib/utils";
import { getDay } from "date-fns";

export async function runLeaveNotifyJob() {
  const today = todayIST();
  const dayOfWeek = getDay(nowIST());

  const settings = await getSettingsCollection();
  const activeUsers = await settings.find({ automationEnabled: true }).toArray();
  const scheduled = await getScheduledActionsCollection();

  for (const user of activeUsers) {
    if (dayOfWeek === 6 && (user.skipSaturday ?? true)) continue;
    if (dayOfWeek === 0 && (user.skipSunday ?? true)) continue;

    const existing = await scheduled.findOne({
      userId: user.userId,
      date: today,
      action: "leave_notify",
    });

    if (existing?.executed) continue;

    const leaves = await getLeavesCollection();
    const onLeave = await leaves.findOne({ userId: user.userId, date: today });

    if (onLeave) {
      await scheduled.updateOne(
        { userId: user.userId, date: today, action: "leave_notify" },
        { $set: { targetTime: "09:00", executed: true } },
        { upsert: true }
      );
      await sendLeaveNotificationEmail(user.hrmsEmail, today, onLeave.reason);
      console.log(`[LEAVE-NOTIFY] Sent leave email to ${user.hrmsEmail}`);
    }
  }
}
