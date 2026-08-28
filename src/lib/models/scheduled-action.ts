import { getDb } from "../db";

export interface IScheduledAction {
  userId: number;
  date: string; // "YYYY-MM-DD"
  action: "checkin" | "checkout" | "leave_notify";
  targetTime: string; // "HH:mm"
  executed: boolean;
  result?: "success" | "skipped" | "failed" | "missed" | "on_leave" | "holiday";
}

export async function getScheduledActionsCollection() {
  const db = await getDb();
  return db.collection<IScheduledAction>("scheduled_actions");
}

// Index creation lives in ./indexes.ts, which the cron route actually calls.
// The version that used to live here was never invoked from anywhere.
