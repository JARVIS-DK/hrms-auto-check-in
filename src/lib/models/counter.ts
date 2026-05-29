import { getDb } from "../db";

interface ICounter {
  _id: string;
  seq: number;
}

export async function getNextId(collectionName: string): Promise<number> {
  const db = await getDb();
  const counters = db.collection<ICounter>("counters");

  const result = await counters.findOneAndUpdate(
    { _id: collectionName },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  return result!.seq;
}
