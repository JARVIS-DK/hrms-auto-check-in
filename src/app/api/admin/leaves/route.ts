import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAdminError } from "@/lib/middleware/adminAuth";
import { getDb } from "@/lib/db";
import { getLeavesCollection, isLeaveType } from "@/lib/models/leave";
import { getUsersCollection } from "@/lib/models/user";
import { getNextId } from "@/lib/models/counter";
import { isValidDateString, isValidTimeString } from "@/lib/utils";

const MAX_DATES_PER_REQUEST = 60;
const MAX_REASON_LENGTH = 200;

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const db = await getDb();
    const query: Record<string, unknown> = {};

    if (filterUserId) {
      query.userId = parseInt(filterUserId, 10);
    }

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.date = { $gte: startDate };
    } else if (endDate) {
      query.date = { $lte: endDate };
    }

    // Aggregate leaves with user information
    const leavesAgg = await db.collection("leaves").aggregate([
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          date: 1,
          type: 1,
          reason: 1,
          createdAt: 1,
          userName: { $arrayElemAt: ["$user.name", 0] },
          userEmail: { $arrayElemAt: ["$user.email", 0] }
        }
      },
      { $sort: { date: -1 } }
    ]).toArray();

    return NextResponse.json({
      leaves: leavesAgg.map((leave) => ({
        id: leave._id,
        userId: leave.userId,
        userName: leave.userName,
        userEmail: leave.userEmail,
        date: leave.date,
        // Records predating half-day support carry no `type` and are full days.
        type: leave.type ?? "full",
        reason: leave.reason,
        createdAt: leave.createdAt,
      })),
      total: leavesAgg.length,
    });
  } catch (err) {
    return handleAdminError("/admin/leaves", err, { leaves: [], total: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const userId = Number(body.userId);
    const { dates, reason } = body;
    const type = body.type ?? "full";

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Valid userId is required" }, { status: 400 });
    }
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

    const users = await getUsersCollection();
    const target = await users.findOne({ _id: userId });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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

    const windowStart = typeof body.windowStart === "string" ? body.windowStart : "";
    const windowEnd = typeof body.windowEnd === "string" ? body.windowEnd : "";

    if (windowStart || windowEnd) {
      if (type === "full") {
        return NextResponse.json({ error: "Times only apply to half-day leave" }, { status: 400 });
      }
      if (!windowStart || !windowEnd) {
        return NextResponse.json(
          { error: "Set both a start and an end time, or leave both blank" },
          { status: 400 }
        );
      }
      if (!isValidTimeString(windowStart) || !isValidTimeString(windowEnd)) {
        return NextResponse.json({ error: "Times must be in HH:mm format" }, { status: 400 });
      }
      if (windowStart >= windowEnd) {
        return NextResponse.json({ error: "Start time must be before end time" }, { status: 400 });
      }
    }

    const leaves = await getLeavesCollection();
    const trimmedReason = typeof reason === "string" && reason.trim() ? reason.trim() : undefined;
    const hasWindow = Boolean(windowStart && windowEnd);
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
    return handleAdminError("/admin/leaves", err);
  }
}
