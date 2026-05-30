import cron from "node-cron";
import { runCheckinJob } from "./checkin";
import { runCheckoutJob } from "./checkout";
import { runLeaveNotifyJob } from "./leave-notify";
import { nowIST } from "@/lib/utils";
import { format } from "date-fns";

export function initCronJobs() {
  const currentIST = format(nowIST(), "yyyy-MM-dd HH:mm:ss");
  console.log(`[CRON] Starting scheduler. Current IST time: ${currentIST}`);

  // Leave notification at 9:00 AM IST
  cron.schedule("0 9 * * *", () => {
    console.log(`[CRON] Running leave notification job`);
    runLeaveNotifyJob().catch((err) =>
      console.error("[CRON] Leave notify job error:", err)
    );
  }, { timezone: "Asia/Kolkata" });

  // Run every minute to check if any user's window is active
  cron.schedule("* * * * *", () => {
    const time = format(nowIST(), "HH:mm");
    console.log(`[CRON] Tick at ${time} IST`);
    runCheckinJob().catch((err) =>
      console.error("[CRON] Check-in job error:", err)
    );
    runCheckoutJob().catch((err) =>
      console.error("[CRON] Check-out job error:", err)
    );
  }, { timezone: "Asia/Kolkata" });

  console.log("[CRON] Scheduler active — leave notify at 9:00 AM, check-in/out every minute.");
}
