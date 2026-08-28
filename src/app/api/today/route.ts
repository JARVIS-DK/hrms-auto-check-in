import { NextResponse } from "next/server";
import { getDay } from "date-fns";
import { getAuthUser } from "@/lib/auth";
import { getSettingsCollection } from "@/lib/models/settings";
import { getLeavesCollection, leaveTypeOf } from "@/lib/models/leave";
import { getScheduledActionsCollection } from "@/lib/models/scheduled-action";
import { getGlobalDefaults } from "@/lib/models/global-settings";
import { findHoliday } from "@/lib/models/holiday";
import { resolveWindow } from "@/lib/schedule";
import { todayIST, nowIST } from "@/lib/utils";

/**
 * What the scheduler intends to do for this user today.
 *
 * The randomly-chosen target time was previously invisible — a user had no way
 * to know when, or whether, automation would fire.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const date = todayIST();
    const dayOfWeek = getDay(nowIST());

    const [settingsCol, leavesCol, scheduledCol, defaults, holiday] = await Promise.all([
      getSettingsCollection(),
      getLeavesCollection(),
      getScheduledActionsCollection(),
      getGlobalDefaults(),
      findHoliday(date),
    ]);

    const settings = await settingsCol.findOne({ userId: user.userId });
    if (!settings) {
      return NextResponse.json({
        date,
        automationEnabled: false,
        holiday: null,
        leave: null,
        weekendSkip: null,
        checkin: null,
        checkout: null,
      });
    }

    const [leave, rows] = await Promise.all([
      holiday ? Promise.resolve(null) : leavesCol.findOne({ userId: user.userId, date }),
      scheduledCol.find({ userId: user.userId, date }).toArray(),
    ]);

    const rowFor = (action: string) => rows.find((r) => r.action === action) ?? null;

    const weekendSkip =
      dayOfWeek === 6 && (settings.skipSaturday ?? true)
        ? "Saturday"
        : dayOfWeek === 0 && (settings.skipSunday ?? true)
          ? "Sunday"
          : null;

    // The stored target time is authoritative once the day's row exists; before
    // that, show the window the random pick will come from.
    function describe(kind: "checkin" | "checkout") {
      const row = rowFor(kind);
      const window = holiday ? null : resolveWindow(kind, settings!, defaults, leave);
      return {
        window,
        targetTime: row?.targetTime ?? null,
        executed: row?.executed ?? false,
        result: row?.result ?? null,
      };
    }

    return NextResponse.json({
      date,
      automationEnabled: settings.automationEnabled,
      holiday: holiday ? { name: holiday.name } : null,
      leave: leave ? { type: leaveTypeOf(leave), reason: leave.reason ?? null } : null,
      weekendSkip,
      checkin: describe("checkin"),
      checkout: describe("checkout"),
    });
  } catch (err) {
    console.error("[API /today GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
