import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getLogsCollection } from "@/lib/models/log";
import { clampInt, istDayRangeUtc, isValidDateString } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    // Clamped: an unbounded or non-numeric limit used to reach Mongo directly,
    // either dumping the whole collection or making `skip` NaN and throwing.
    const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
    const limit = clampInt(searchParams.get("limit"), 20, 1, 100);
    const skip = (page - 1) * limit;

    const filterDate = searchParams.get("date");
    const filterAction = searchParams.get("action");
    const filterStatus = searchParams.get("status");

    const logs = await getLogsCollection();

    const query: Record<string, unknown> = { userId: user.userId };

    if (filterAction) {
      query.action = filterAction;
    }

    if (filterStatus) {
      query.status = filterStatus;
    }

    // Still filters the stored `executedAt` instant, so existing records are
    // matched exactly as before — only the day boundaries move from UTC to IST,
    // which is the timezone every displayed time is already rendered in.
    if (isValidDateString(filterDate)) {
      const { start, end } = istDayRangeUtc(filterDate);
      query.executedAt = { $gte: start, $lte: end };
    }

    const [docs, total] = await Promise.all([
      logs.find(query).sort({ executedAt: -1 }).skip(skip).limit(limit).toArray(),
      logs.countDocuments(query),
    ]);

    return NextResponse.json({
      logs: docs.map((d) => ({
        id: d._id,
        action: d.action,
        status: d.status,
        executedAt: d.executedAt,
        skipReason: d.skipReason,
        errorMessage: d.errorMessage,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[API /logs GET]", err);
    return NextResponse.json({ error: "Internal server error", logs: [], total: 0, page: 1, totalPages: 1 }, { status: 500 });
  }
}
