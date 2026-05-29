import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getLogsCollection } from "@/lib/models/log";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
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

    if (filterDate) {
      const start = new Date(`${filterDate}T00:00:00.000Z`);
      const end = new Date(`${filterDate}T23:59:59.999Z`);
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
