import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAdminError } from "@/lib/middleware/adminAuth";
import { clampInt } from "@/lib/utils";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = clampInt(searchParams.get("page"), 1, 1, 10_000);
    const limit = 30;
    const skip = (page - 1) * limit;

    const filterUserId = searchParams.get("userId");
    const filterAction = searchParams.get("action");
    const filterStatus = searchParams.get("status");
    const filterDate = searchParams.get("date");

    const db = await getDb();
    const query: Record<string, unknown> = {};

    if (filterDate) {
      query.date = filterDate;
    }

    if (filterStatus === "executed") {
      query.executed = true;
    } else if (filterStatus === "pending") {
      query.executed = false;
    }

    if (filterUserId) {
      const userId = parseInt(filterUserId, 10);
      if (!Number.isNaN(userId)) query.userId = userId;
    }

    if (filterAction) {
      query.action = filterAction;
    }

    const total = await db.collection("scheduled_actions").countDocuments(query);

    // Aggregate scheduled actions with user information
    const actionsAgg = await db.collection("scheduled_actions").aggregate([
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
          userId: 1,
          date: 1,
          action: 1,
          targetTime: 1,
          executed: 1,
          result: 1,
          userName: { $arrayElemAt: ["$user.name", 0] },
          userEmail: { $arrayElemAt: ["$user.email", 0] }
        }
      },
      { $sort: { date: -1, targetTime: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]).toArray();

    return NextResponse.json({
      scheduledActions: actionsAgg.map((action) => ({
        userId: action.userId,
        userName: action.userName,
        userEmail: action.userEmail,
        date: action.date,
        action: action.action,
        targetTime: action.targetTime,
        executed: action.executed,
        result: action.result || null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return handleAdminError("/admin/scheduled-actions", err, {
      scheduledActions: [],
      total: 0,
      page: 1,
      totalPages: 1,
    });
  }
}
