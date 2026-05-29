import { getDb } from "../db";
import { getNextId } from "./counter";

export interface ILog {
  _id: number;
  userId: number;
  action: "CHECK_IN" | "CHECK_OUT";
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  scheduledAt: Date;
  executedAt: Date;
  responseData?: Record<string, unknown>;
  errorMessage?: string;
  skipReason?: string;
}

export async function getLogsCollection() {
  const db = await getDb();
  return db.collection<ILog>("logs");
}

export async function insertLog(data: Omit<ILog, "_id">) {
  const _id = await getNextId("logs");
  const logs = await getLogsCollection();
  await logs.insertOne({ ...data, _id });
  return { ...data, _id };
}
