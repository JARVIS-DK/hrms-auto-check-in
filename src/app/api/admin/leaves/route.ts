import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAdminError } from "@/lib/middleware/adminAuth";
import { getDb } from "@/lib/db";

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
