import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAdminError } from "@/lib/middleware/adminAuth";
import { getDb } from "@/lib/db";
import { clampInt, istDayRangeUtc, isValidDateString } from "@/lib/utils";

const ROUTE = "/admin/logs";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
    const limit = clampInt(searchParams.get("limit"), 50, 1, 100);
    const skip = (page - 1) * limit;

    const filterUserId = searchParams.get("userId");
    const filterAction = searchParams.get("action");
    const filterStatus = searchParams.get("status");
    const filterDate = searchParams.get("date");

    const db = await getDb();
    const query: Record<string, unknown> = {};

    if (filterUserId) {
      const userId = parseInt(filterUserId, 10);
      if (!Number.isNaN(userId)) query.userId = userId;
    }

    if (filterAction) {
      query.action = filterAction;
    }

    if (filterStatus) {
      query.status = filterStatus;
    }

    // IST day boundaries — see lib/utils.istDayRangeUtc. Matching against
    // `${date}T00:00:00.000Z` dropped every evening check-out from its own day.
    if (isValidDateString(filterDate)) {
      const { start, end } = istDayRangeUtc(filterDate);
      query.executedAt = { $gte: start, $lte: end };
    }

    // Aggregate logs with user information
    const logsAgg = await db.collection("logs").aggregate([
      { $match: query },
      { $sort: { executedAt: -1 } },
      { $skip: skip },
      { $limit: limit },
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
          action: 1,
          status: 1,
          executedAt: 1,
          scheduledAt: 1,
          skipReason: 1,
          errorMessage: 1,
          userName: { $arrayElemAt: ["$user.name", 0] },
          userEmail: { $arrayElemAt: ["$user.email", 0] }
        }
      }
    ]).toArray();

    const total = await db.collection("logs").countDocuments(query);

    return NextResponse.json({
      logs: logsAgg.map((log) => ({
        id: log._id,
        userId: log.userId,
        userName: log.userName,
        userEmail: log.userEmail,
        action: log.action,
        status: log.status,
        executedAt: log.executedAt,
        scheduledAt: log.scheduledAt,
        skipReason: log.skipReason,
        errorMessage: log.errorMessage,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return handleAdminError(ROUTE, err, { logs: [], total: 0, page: 1, totalPages: 1 });
  }
}
