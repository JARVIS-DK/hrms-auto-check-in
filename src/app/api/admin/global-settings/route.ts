import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAdminError } from "@/lib/middleware/adminAuth";
import {
  getGlobalSettingsCollection,
  getGlobalDefaults,
  DEFAULTS,
  type GlobalDefaults,
} from "@/lib/models/global-settings";
import { isValidTimeString } from "@/lib/utils";

const ROUTE = "/admin/global-settings";

const WINDOWS: { start: keyof GlobalDefaults; end: keyof GlobalDefaults; label: string }[] = [
  { start: "checkinStart", end: "checkinEnd", label: "Check-in" },
  { start: "checkoutStart", end: "checkoutEnd", label: "Check-out" },
  { start: "halfDayCheckinStart", end: "halfDayCheckinEnd", label: "Half-day check-in" },
  { start: "halfDayCheckoutStart", end: "halfDayCheckoutEnd", label: "Half-day check-out" },
];

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getGlobalDefaults());
  } catch (err) {
    return handleAdminError(ROUTE, err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const next = { ...DEFAULTS };

    // Validate the format before storing: a malformed value here silently
    // breaks the "HH:mm" string comparisons the whole scheduler is built on.
    for (const window of WINDOWS) {
      for (const key of [window.start, window.end] as const) {
        const value = body[key];
        if (value === undefined || value === "") continue;
        if (!isValidTimeString(value)) {
          return NextResponse.json(
            { error: `${window.label}: times must be in HH:mm format` },
            { status: 400 }
          );
        }
        next[key] = value;
      }

      if (next[window.start] >= next[window.end]) {
        return NextResponse.json(
          { error: `${window.label} start must be before end` },
          { status: 400 }
        );
      }
    }

    const col = await getGlobalSettingsCollection();
    await col.updateOne(
      { _id: "global" },
      { $set: { ...next, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAdminError(ROUTE, err);
  }
}
