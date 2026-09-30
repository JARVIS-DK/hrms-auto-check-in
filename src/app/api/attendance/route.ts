import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getLogsCollection } from "@/lib/models/log";
import { getLeavesCollection } from "@/lib/models/leave";
import { listUpcomingHolidays } from "@/lib/models/holiday";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const rawMonth = searchParams.get("month");

    const match = rawMonth?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    if (!match) {
      return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
    }

    const year = Number(match[1]);
    const month = Number(match[2]);

    const firstDay = `${rawMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const lastDayStr = `${rawMonth}-${String(lastDay).padStart(2, "0")}`;

    const startUtc = new Date(`${firstDay}T00:00:00.000+05:30`);
    const endUtc = new Date(`${lastDayStr}T23:59:59.999+05:30`);

    const [logs, leavesDocs, holidays] = await Promise.all([
      getLogsCollection().then((col) =>
        col
          .find({
            userId: user.userId,
            status: "SUCCESS",
            executedAt: { $gte: startUtc, $lte: endUtc },
          })
          .sort({ executedAt: 1 })
          .toArray()
      ),
      getLeavesCollection().then((col) =>
        col
          .find({
            userId: user.userId,
            date: { $gte: firstDay, $lte: lastDayStr },
          })
          .toArray()
      ),
      listUpcomingHolidays(firstDay).then((all) =>
        all.filter((h) => h.date >= firstDay && h.date <= lastDayStr)
      ),
    ]);

    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const days: Record<
      string,
      { checkin: string | null; checkout: string | null; workingHours: number | null }
    > = {};

    for (const log of logs) {
      const istTime = new Date(new Date(log.executedAt).getTime() + IST_OFFSET);
      const dateKey = istTime.toISOString().slice(0, 10);
      if (!days[dateKey]) days[dateKey] = { checkin: null, checkout: null, workingHours: null };

      const timeStr = istTime.toISOString().slice(11, 16);
      if (log.action === "CHECK_IN") {
        if (!days[dateKey].checkin || timeStr < days[dateKey].checkin!) {
          days[dateKey].checkin = timeStr;
        }
      } else if (log.action === "CHECK_OUT") {
        if (!days[dateKey].checkout || timeStr > days[dateKey].checkout!) {
          days[dateKey].checkout = timeStr;
        }
      }
    }

    for (const [date, day] of Object.entries(days)) {
      if (day.checkin && day.checkout) {
        const [ciH, ciM] = day.checkin.split(":").map(Number);
        const [coH, coM] = day.checkout.split(":").map(Number);
        const diffMin = (coH * 60 + coM) - (ciH * 60 + ciM);
        day.workingHours = diffMin > 0 ? Math.round((diffMin / 60) * 100) / 100 : null;
      }
      void date;
    }

    const leavesMap: Record<string, string> = {};
    for (const l of leavesDocs) {
      leavesMap[l.date] = l.type ?? "full";
    }

    const holidaysMap: Record<string, string> = {};
    for (const h of holidays) {
      holidaysMap[h.date] = h.name;
    }

    return NextResponse.json({ days, leaves: leavesMap, holidays: holidaysMap });
  } catch (err) {
    console.error("[API /attendance GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
