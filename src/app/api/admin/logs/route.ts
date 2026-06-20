import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/adminAuth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const filterUserId = searchParams.get("userId");
    const filterAction = searchParams.get("action");
    const filterStatus = searchParams.get("status");
    const filterDate = searchParams.get("date");

    const db = await getDb();
    const query: Record<string, unknown> = {};

    if (filterUserId) {
      query.userId = parseInt(filterUserId, 10);
    }

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

    // Aggregate logs with user information
    const logsAgg = await db.collection("logs").aggregate([
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
          action: 1,
          status: 1,
          executedAt: 1,
          scheduledAt: 1,
          skipReason: 1,
          errorMessage: 1,
          userName: { $arrayElemAt: ["$user.name", 0] },
          userEmail: { $arrayElemAt: ["$user.email", 0] }
        }
      },
      { $sort: { executedAt: -1 } },
      { $skip: skip },
      { $limit: limit }
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
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[API /admin/logs GET]", error);

    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error", logs: [], total: 0, page: 1, totalPages: 1 },
      { status: 500 }
    );
  }
}
