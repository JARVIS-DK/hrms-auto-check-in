import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAdminError } from "@/lib/middleware/adminAuth";
import { getDb } from "@/lib/db";
import { getSettingsCollection, insertSettings } from "@/lib/models/settings";
import { getUsersCollection } from "@/lib/models/user";
import { isValidTimeString } from "@/lib/utils";

const WINDOW_FIELDS = [
  { start: "checkinStart", end: "checkinEnd", label: "Check-in" },
  { start: "checkoutStart", end: "checkoutEnd", label: "Check-out" },
  { start: "halfDayCheckinStart", end: "halfDayCheckinEnd", label: "Half-day check-in" },
  { start: "halfDayCheckoutStart", end: "halfDayCheckoutEnd", label: "Half-day check-out" },
] as const;

const TIME_FIELDS = WINDOW_FIELDS.flatMap((w) => [w.start, w.end]);

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
      halfDayCheckinStart: u.settings?.halfDayCheckinStart || "",
      halfDayCheckinEnd: u.settings?.halfDayCheckinEnd || "",
      halfDayCheckoutStart: u.settings?.halfDayCheckoutStart || "",
      halfDayCheckoutEnd: u.settings?.halfDayCheckoutEnd || "",
      lastActivity: u.lastActivity || null,
      hasSettings: !!u.settings,
      hasPassword: Boolean(u.settings?.hrmsPasswordEncrypted),
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (err) {
    return handleAdminError("/admin/users", err, { users: [] });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const userId = Number(body.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Valid userId is required" }, { status: 400 });
    }

    const users = await getUsersCollection();
    const target = await users.findOne({ _id: userId });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const times = Object.fromEntries(
      TIME_FIELDS.map((f) => [f, typeof body[f] === "string" ? body[f] : undefined])
    ) as Record<(typeof TIME_FIELDS)[number], string | undefined>;

    const hasTimes = TIME_FIELDS.some((f) => times[f] !== undefined);
    const hasAutomation = typeof body.automationEnabled === "boolean";

    if (!hasTimes && !hasAutomation) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    for (const window of WINDOW_FIELDS) {
      const start = times[window.start];
      const end = times[window.end];
      if (start === undefined && end === undefined) continue;

      const startVal = start ?? "";
      const endVal = end ?? "";
      for (const value of [startVal, endVal]) {
        if (value && !isValidTimeString(value)) {
          return NextResponse.json(
            { error: `${window.label}: times must be in HH:mm format` },
            { status: 400 }
          );
        }
      }
      if (startVal && endVal && startVal >= endVal) {
        return NextResponse.json(
          { error: `${window.label} start must be before end` },
          { status: 400 }
        );
      }
      if (Boolean(startVal) !== Boolean(endVal)) {
        return NextResponse.json(
          { error: `${window.label}: set both start and end, or leave both blank` },
          { status: 400 }
        );
      }
    }

    const settings = await getSettingsCollection();
    const existing = await settings.findOne({ userId });
    const hasPassword = Boolean(existing?.hrmsPasswordEncrypted);

    if (hasAutomation && body.automationEnabled && !hasPassword) {
      return NextResponse.json(
        { error: "This user has no HRMS password saved, so the scheduler cannot be turned on" },
        { status: 400 }
      );
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (hasAutomation) patch.automationEnabled = body.automationEnabled;
    for (const field of TIME_FIELDS) {
      if (times[field] !== undefined) patch[field] = times[field];
    }

    if (existing) {
      await settings.updateOne({ userId }, { $set: patch });
    } else if (!hasTimes) {
      return NextResponse.json({ success: true });
    } else {
      await insertSettings({
        userId,
        hrmsEmail: "",
        hrmsPasswordEncrypted: "",
        hrmsPasswordIv: "",
        hrmsPasswordTag: "",
        latitude: "",
        longitude: "",
        automationEnabled: false,
        skipSaturday: true,
        skipSunday: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...Object.fromEntries(TIME_FIELDS.map((f) => [f, times[f] ?? ""])),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAdminError("/admin/users", err);
  }
}
