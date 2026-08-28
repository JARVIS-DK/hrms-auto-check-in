import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getLeavesCollection, isLeaveType, leaveTypeOf } from "@/lib/models/leave";
import { getNextId } from "@/lib/models/counter";
import { isValidDateString, isValidTimeString } from "@/lib/utils";

const MAX_DATES_PER_REQUEST = 60;
const MAX_REASON_LENGTH = 200;

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const leaves = await getLeavesCollection();
    const docs = await leaves.find({ userId: user.userId }).sort({ date: 1 }).toArray();

    return NextResponse.json(
      docs.map((d) => ({
        date: d.date,
        // Records created before half-day support have no `type` and mean a full day.
        type: leaveTypeOf(d),
        windowStart: d.windowStart ?? "",
        windowEnd: d.windowEnd ?? "",
        reason: d.reason,
      }))
    );
  } catch (err) {
    console.error("[API /leaves GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { dates, reason } = body;
    const type = body.type ?? "full";

    if (!Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: "dates array is required" }, { status: 400 });
    }
    if (dates.length > MAX_DATES_PER_REQUEST) {
      return NextResponse.json(
        { error: `At most ${MAX_DATES_PER_REQUEST} dates per request` },
        { status: 400 }
      );
    }
    if (!isLeaveType(type)) {
      return NextResponse.json(
        { error: "type must be full, first_half, or second_half" },
        { status: 400 }
      );
    }

    const unique = [...new Set(dates)];
    const invalid = unique.find((d) => !isValidDateString(d));
    if (invalid !== undefined) {
      return NextResponse.json(
        { error: `Invalid date: ${String(invalid).slice(0, 20)} (expected YYYY-MM-DD)` },
        { status: 400 }
      );
    }

    if (typeof reason === "string" && reason.length > MAX_REASON_LENGTH) {
      return NextResponse.json(
        { error: `Reason must be at most ${MAX_REASON_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Optional per-day override of the half-day window. Blank means fall back
    // to the user's half-day setting, then the global default.
    const windowStart = typeof body.windowStart === "string" ? body.windowStart : "";
    const windowEnd = typeof body.windowEnd === "string" ? body.windowEnd : "";

    if (windowStart || windowEnd) {
      if (type === "full") {
        return NextResponse.json(
          { error: "Times only apply to half-day leave" },
          { status: 400 }
        );
      }
      if (!windowStart || !windowEnd) {
        return NextResponse.json(
          { error: "Set both a start and an end time, or leave both blank" },
          { status: 400 }
        );
      }
      if (!isValidTimeString(windowStart) || !isValidTimeString(windowEnd)) {
        return NextResponse.json(
          { error: "Times must be in HH:mm format" },
          { status: 400 }
        );
      }
      if (windowStart >= windowEnd) {
        return NextResponse.json({ error: "Start time must be before end time" }, { status: 400 });
      }
    }

    const leaves = await getLeavesCollection();
    const userId = user.userId;
    const trimmedReason = typeof reason === "string" && reason.trim() ? reason.trim() : undefined;
    const hasWindow = Boolean(windowStart && windowEnd);

    // One round-trip instead of a findOne per date. Upsert so re-submitting a
    // date updates its type rather than being silently ignored.
    const ids = await Promise.all(unique.map(() => getNextId("leaves")));
    const result = await leaves.bulkWrite(
      unique.map((date, i) => ({
        updateOne: {
          filter: { userId, date: date as string },
          update: {
            $set: {
              type,
              ...(trimmedReason ? { reason: trimmedReason } : {}),
              ...(hasWindow ? { windowStart, windowEnd } : {}),
            },
            // Clear a stale override when the day is resubmitted without one,
            // so the leave doesn't silently keep yesterday's custom times.
            ...(hasWindow ? {} : { $unset: { windowStart: "", windowEnd: "" } }),
            $setOnInsert: {
              _id: ids[i],
              userId,
              date: date as string,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    return NextResponse.json({
      success: true,
      count: result.upsertedCount,
      updated: result.modifiedCount,
    });
  } catch (err) {
    console.error("[API /leaves POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const date = req.nextUrl.searchParams.get("date");
    if (!isValidDateString(date)) {
      return NextResponse.json({ error: "Valid date param required" }, { status: 400 });
    }

    const leaves = await getLeavesCollection();
    await leaves.deleteOne({ userId: user.userId, date });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API /leaves DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
