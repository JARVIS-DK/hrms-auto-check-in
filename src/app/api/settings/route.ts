import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getSettingsCollection, insertSettings, type ISettings } from "@/lib/models/settings";
import { getGlobalDefaults } from "@/lib/models/global-settings";
import { encrypt } from "@/lib/crypto";
import { hrmsLogin } from "@/lib/hrms/client";
import { isValidTimeString } from "@/lib/utils";

/** Window overrides; blank means "use the global default". */
const WINDOW_FIELDS = [
  { start: "checkinStart", end: "checkinEnd", label: "Check-in" },
  { start: "checkoutStart", end: "checkoutEnd", label: "Check-out" },
  { start: "halfDayCheckinStart", end: "halfDayCheckinEnd", label: "Half-day check-in" },
  { start: "halfDayCheckoutStart", end: "halfDayCheckoutEnd", label: "Half-day check-out" },
] as const;

const TIME_FIELDS = WINDOW_FIELDS.flatMap((w) => [w.start, w.end]);

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [settings, defaults] = await Promise.all([
      getSettingsCollection(),
      getGlobalDefaults(),
    ]);
    const doc = await settings.findOne({ userId: user.userId });

    const times = Object.fromEntries(TIME_FIELDS.map((f) => [f, doc?.[f] || ""]));

    // The windows actually in force, with the user's blanks already resolved
    // against the global defaults. Sent so the UI can show a real schedule
    // instead of re-implementing the fallback chain client-side.
    const effective = Object.fromEntries(
      TIME_FIELDS.map((f) => [f, doc?.[f] || defaults[f]])
    );

    return NextResponse.json({
      hrmsEmail: doc?.hrmsEmail ?? "",
      latitude: doc?.latitude ?? "",
      longitude: doc?.longitude ?? "",
      automationEnabled: doc?.automationEnabled ?? false,
      hasPassword: !!doc?.hrmsPasswordEncrypted,
      ...times,
      effective,
      skipSaturday: doc?.skipSaturday ?? true,
      skipSunday: doc?.skipSunday ?? true,
    });
  } catch (err) {
    console.error("[API /settings GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const settings = await getSettingsCollection();
    const userId = user.userId;
    const existing = await settings.findOne({ userId });

    const pick = <K extends keyof ISettings>(key: K, fallback: ISettings[K]): ISettings[K] =>
      (body[key] ?? existing?.[key] ?? fallback) as ISettings[K];

    const update: Omit<ISettings, "_id" | "createdAt"> = {
      userId,
      hrmsEmail: pick("hrmsEmail", ""),
      hrmsPasswordEncrypted: existing?.hrmsPasswordEncrypted ?? "",
      hrmsPasswordIv: existing?.hrmsPasswordIv ?? "",
      hrmsPasswordTag: existing?.hrmsPasswordTag ?? "",
      latitude: pick("latitude", ""),
      longitude: pick("longitude", ""),
      automationEnabled: pick("automationEnabled", false),
      skipSaturday: pick("skipSaturday", true),
      skipSunday: pick("skipSunday", true),
      updatedAt: new Date(),
      ...Object.fromEntries(TIME_FIELDS.map((f) => [f, pick(f, "")])),
    };

    // Blank is meaningful (fall back to the global default); anything else has
    // to be a real HH:mm, since the scheduler compares these as strings.
    for (const window of WINDOW_FIELDS) {
      const start = update[window.start];
      const end = update[window.end];

      for (const value of [start, end]) {
        if (value && !isValidTimeString(value)) {
          return NextResponse.json(
            { error: `${window.label}: times must be in HH:mm format` },
            { status: 400 }
          );
        }
      }
      if (start && end && start >= end) {
        return NextResponse.json(
          { error: `${window.label} start must be before end` },
          { status: 400 }
        );
      }
      if (Boolean(start) !== Boolean(end)) {
        return NextResponse.json(
          { error: `${window.label}: set both start and end, or leave both blank` },
          { status: 400 }
        );
      }
    }

    if (body.hrmsPassword) {
      // Verify against HRMS before storing, so a typo surfaces here rather than
      // as a silent 6am failure email.
      try {
        await hrmsLogin(update.hrmsEmail, body.hrmsPassword);
      } catch {
        return NextResponse.json(
          { error: "Invalid HRMS credentials. Login failed." },
          { status: 422 }
        );
      }
      const { encrypted, iv, tag } = encrypt(body.hrmsPassword);
      update.hrmsPasswordEncrypted = encrypted;
      update.hrmsPasswordIv = iv;
      update.hrmsPasswordTag = tag;
    }

    if (existing) {
      await settings.updateOne({ userId }, { $set: update });
    } else {
      await insertSettings({ ...update, createdAt: new Date() });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API /settings PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
