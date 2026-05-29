import cron from "node-cron";
import { runCheckinJob } from "./checkin";
import { runCheckoutJob } from "./checkout";
import { nowIST } from "@/lib/utils";
import { format } from "date-fns";

export function initCronJobs() {
  const currentIST = format(nowIST(), "yyyy-MM-dd HH:mm:ss");
  console.log(`[CRON] Starting scheduler. Current IST time: ${currentIST}`);

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

  console.log("[CRON] Scheduler active — runs every minute.");
}
