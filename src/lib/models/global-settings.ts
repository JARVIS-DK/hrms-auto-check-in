import { getDb } from "../db";

export interface IGlobalSettings {
  _id: "global";
  checkinStart: string;
  checkinEnd: string;
  checkoutStart: string;
  checkoutEnd: string;
  /** Arrival window used when the user is on first-half leave. */
  halfDayCheckinStart: string;
  halfDayCheckinEnd: string;
  /** Departure window used when the user is on second-half leave. */
  halfDayCheckoutStart: string;
  halfDayCheckoutEnd: string;
  updatedAt: Date;
}

export type GlobalDefaults = Omit<IGlobalSettings, "_id" | "updatedAt">;

export const DEFAULTS: GlobalDefaults = {
  checkinStart: "09:30",
  checkinEnd: "10:00",
  checkoutStart: "19:30",
  checkoutEnd: "20:00",
  halfDayCheckinStart: "14:00",
  halfDayCheckinEnd: "14:30",
  halfDayCheckoutStart: "14:00",
  halfDayCheckoutEnd: "14:30",
};

export async function getGlobalSettingsCollection() {
  const db = await getDb();
  return db.collection<IGlobalSettings>("global_settings");
}

export async function getGlobalDefaults(): Promise<GlobalDefaults> {
  const col = await getGlobalSettingsCollection();
  const doc = await col.findOne({ _id: "global" });
  if (!doc) return DEFAULTS;

  // Field-by-field fallback: a document saved before the half-day windows
  // existed has no value for them and must not yield undefined.
  return {
    checkinStart: doc.checkinStart || DEFAULTS.checkinStart,
    checkinEnd: doc.checkinEnd || DEFAULTS.checkinEnd,
    checkoutStart: doc.checkoutStart || DEFAULTS.checkoutStart,
    checkoutEnd: doc.checkoutEnd || DEFAULTS.checkoutEnd,
    halfDayCheckinStart: doc.halfDayCheckinStart || DEFAULTS.halfDayCheckinStart,
    halfDayCheckinEnd: doc.halfDayCheckinEnd || DEFAULTS.halfDayCheckinEnd,
    halfDayCheckoutStart: doc.halfDayCheckoutStart || DEFAULTS.halfDayCheckoutStart,
    halfDayCheckoutEnd: doc.halfDayCheckoutEnd || DEFAULTS.halfDayCheckoutEnd,
  };
}
