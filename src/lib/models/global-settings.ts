import { getDb } from "../db";

export interface IGlobalSettings {
  _id: "global";
  checkinStart: string;
  checkinEnd: string;
  checkoutStart: string;
  checkoutEnd: string;
  updatedAt: Date;
}

const DEFAULTS: Omit<IGlobalSettings, "_id" | "updatedAt"> = {
  checkinStart: "09:30",
  checkinEnd: "10:00",
  checkoutStart: "19:30",
  checkoutEnd: "20:00",
};

export async function getGlobalSettingsCollection() {
  const db = await getDb();
  return db.collection<IGlobalSettings>("global_settings");
}

export async function getGlobalDefaults(): Promise<Omit<IGlobalSettings, "_id" | "updatedAt">> {
  const col = await getGlobalSettingsCollection();
  const doc = await col.findOne({ _id: "global" });
  if (!doc) return DEFAULTS;
  return {
    checkinStart: doc.checkinStart || DEFAULTS.checkinStart,
    checkinEnd: doc.checkinEnd || DEFAULTS.checkinEnd,
    checkoutStart: doc.checkoutStart || DEFAULTS.checkoutStart,
    checkoutEnd: doc.checkoutEnd || DEFAULTS.checkoutEnd,
  };
}
