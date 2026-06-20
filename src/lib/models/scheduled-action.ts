import { getDb } from "../db";

export interface IScheduledAction {
  userId: number;
  date: string; // "YYYY-MM-DD"
  action: "checkin" | "checkout" | "leave_notify";
  targetTime: string; // "HH:mm"
  executed: boolean;
  result?: "success" | "skipped" | "failed" | "missed" | "on_leave";
}

export async function getScheduledActionsCollection() {
  const db = await getDb();
  return db.collection<IScheduledAction>("scheduled_actions");
}

export async function ensureScheduledActionIndexes() {
  const col = await getScheduledActionsCollection();
  await col.createIndex({ userId: 1, date: 1, action: 1 }, { unique: true });
}
