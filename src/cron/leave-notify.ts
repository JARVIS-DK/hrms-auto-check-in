import { getSettingsCollection } from "@/lib/models/settings";
import { getLeavesCollection } from "@/lib/models/leave";
import { sendLeaveNotificationEmail } from "@/lib/mail";
import { todayIST, nowIST } from "@/lib/utils";
import { getDay } from "date-fns";

const notified = new Set<string>();

export async function runLeaveNotifyJob() {
  const today = todayIST();
  const dayOfWeek = getDay(nowIST());

  const settings = await getSettingsCollection();
  const activeUsers = await settings.find({ automationEnabled: true }).toArray();

  for (const user of activeUsers) {
    const key = `${user.userId}:${today}`;

    if (notified.has(key)) continue;

    if (dayOfWeek === 6 && (user.skipSaturday ?? true)) continue;
    if (dayOfWeek === 0 && (user.skipSunday ?? true)) continue;

    const leaves = await getLeavesCollection();
    const onLeave = await leaves.findOne({ userId: user.userId, date: today });

    if (onLeave) {
      notified.add(key);
      await sendLeaveNotificationEmail(user.hrmsEmail, today, onLeave.reason);
      console.log(`[LEAVE-NOTIFY] Sent leave email to ${user.hrmsEmail}`);
    }
  }
}
