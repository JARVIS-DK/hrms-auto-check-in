import { getDb } from "../db";
import { getNextId } from "./counter";

/**
 * An org-wide non-working day. Applies to every user regardless of their own
 * leave records, and takes precedence over them — the office being closed
 * outranks an individual's half-day.
 */
export interface IHoliday {
  _id: number;
  date: string; // YYYY-MM-DD
  name: string;
  createdBy: number;
  createdAt: Date;
}

export async function getHolidaysCollection() {
  const db = await getDb();
  return db.collection<IHoliday>("holidays");
}

export async function insertHoliday(data: Omit<IHoliday, "_id">) {
  const _id = await getNextId("holidays");
  const holidays = await getHolidaysCollection();
  await holidays.insertOne({ ...data, _id });
  return { ...data, _id };
}

export async function findHoliday(date: string): Promise<IHoliday | null> {
  const holidays = await getHolidaysCollection();
  return holidays.findOne({ date });
}

/** Upcoming holidays from `from` (inclusive), oldest first. */
export async function listUpcomingHolidays(from: string, limit = 50): Promise<IHoliday[]> {
  const holidays = await getHolidaysCollection();
  return holidays
    .find({ date: { $gte: from } })
    .sort({ date: 1 })
    .limit(limit)
    .toArray();
}
