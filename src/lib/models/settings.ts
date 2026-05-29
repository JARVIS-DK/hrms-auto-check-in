import { getDb } from "../db";
import { getNextId } from "./counter";

export interface ISettings {
  _id: number;
  userId: number;
  hrmsEmail: string;
  hrmsPasswordEncrypted: string;
  hrmsPasswordIv: string;
  hrmsPasswordTag: string;
  latitude: string;
  longitude: string;
  automationEnabled: boolean;
  checkinStart?: string;
  checkinEnd?: string;
  checkoutStart?: string;
  checkoutEnd?: string;
  skipSaturday?: boolean;
  skipSunday?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function getSettingsCollection() {
  const db = await getDb();
  return db.collection<ISettings>("settings");
}

export async function insertSettings(data: Omit<ISettings, "_id">) {
  const _id = await getNextId("settings");
  const settings = await getSettingsCollection();
  await settings.insertOne({ ...data, _id });
  return { ...data, _id };
}
