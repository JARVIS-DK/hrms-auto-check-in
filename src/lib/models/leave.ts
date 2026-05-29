import { getDb } from "../db";
import { getNextId } from "./counter";

export interface ILeave {
  _id: number;
  userId: number;
  date: string; // YYYY-MM-DD
  reason?: string;
  createdAt: Date;
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
