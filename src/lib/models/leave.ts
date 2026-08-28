import { getDb } from "../db";
import { getNextId } from "./counter";

/**
 * "first_half" = away for the morning, arriving at midday.
 * "second_half" = present in the morning, leaving at midday.
 * Absent on existing records, which are all full days.
 */
export type LeaveType = "full" | "first_half" | "second_half";

export const LEAVE_TYPES: LeaveType[] = ["full", "first_half", "second_half"];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  full: "Full day",
  first_half: "First half (morning off)",
  second_half: "Second half (afternoon off)",
};

export interface ILeave {
  _id: number;
  userId: number;
  date: string; // YYYY-MM-DD
  type?: LeaveType; // absent on records created before half-day support
  /**
   * Overrides the half-day window for this date only, ahead of the user's own
   * half-day setting and the global default. Set together or not at all;
   * meaningless on a full-day leave.
   */
  windowStart?: string;
  windowEnd?: string;
  reason?: string;
  createdAt: Date;
}

export function isLeaveType(value: unknown): value is LeaveType {
  return typeof value === "string" && (LEAVE_TYPES as string[]).includes(value);
}

/** Records written before half-day support carry no `type` and mean a full day. */
export function leaveTypeOf(leave: Pick<ILeave, "type"> | null | undefined): LeaveType {
  return leave?.type ?? "full";
}

export async function getLeavesCollection() {
  const db = await getDb();
  return db.collection<ILeave>("leaves");
}

export async function insertLeave(data: Omit<ILeave, "_id">) {
  const _id = await getNextId("leaves");
  const leaves = await getLeavesCollection();
  await leaves.insertOne({ ...data, _id });
  return { ...data, _id };
}
