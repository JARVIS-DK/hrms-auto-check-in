import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/adminAuth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();

    const db = await getDb();

    // Aggregation pipeline to join users with their settings
    const users = await db.collection("users").aggregate([
      {
        $lookup: {
          from: "settings",
          localField: "_id",
          foreignField: "userId",
          as: "settings"
        }
      },
      {
        $lookup: {
          from: "logs",
          let: { userId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", "$$userId"] } } },
            { $sort: { executedAt: -1 } },
            { $limit: 1 }
          ],
          as: "lastLog"
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          role: 1,
          createdAt: 1,
          settings: { $arrayElemAt: ["$settings", 0] },
          lastActivity: { $arrayElemAt: ["$lastLog.executedAt", 0] }
        }
      },
      {
        $sort: {
          "settings.automationEnabled": -1,
          name: 1
        }
      }
    ]).toArray();

    const formattedUsers = users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role || "user",
      automationEnabled: u.settings?.automationEnabled || false,
      checkinStart: u.settings?.checkinStart || "",
      checkinEnd: u.settings?.checkinEnd || "",
      checkoutStart: u.settings?.checkoutStart || "",
      checkoutEnd: u.settings?.checkoutEnd || "",
      lastActivity: u.lastActivity || null,
      hasSettings: !!u.settings,
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[API /admin/users GET]", error);

    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
