import { getDb } from "../db";
import { getNextId } from "./counter";

export interface IUser {
  _id: number;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

export async function getUsersCollection() {
  const db = await getDb();
  return db.collection<IUser>("users");
}

export async function insertUser(data: Omit<IUser, "_id">) {
  const _id = await getNextId("users");
  const users = await getUsersCollection();
  await users.insertOne({ ...data, _id });
  return { ...data, _id };
}
