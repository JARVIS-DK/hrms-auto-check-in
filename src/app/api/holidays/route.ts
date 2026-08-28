import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { listUpcomingHolidays } from "@/lib/models/holiday";
import { todayIST } from "@/lib/utils";

/**
 * Read-only view for signed-in users, so the leaves page can show which days
 * are already covered before someone books leave on one.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const holidays = await listUpcomingHolidays(todayIST());
    return NextResponse.json(holidays.map((h) => ({ date: h.date, name: h.name })));
  } catch (err) {
    console.error("[API /holidays GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
