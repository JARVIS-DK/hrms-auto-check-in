import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getSettingsCollection } from "@/lib/models/settings";
import { insertLog } from "@/lib/models/log";
import { decrypt } from "@/lib/crypto";
import { hrmsLogin, hrmsGetState, hrmsCheckin } from "@/lib/hrms/client";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { logType } = await req.json();
    if (logType !== "IN" && logType !== "OUT") {
      return NextResponse.json({ error: "logType must be IN or OUT" }, { status: 400 });
    }

    const settings = await getSettingsCollection();
    const userSettings = await settings.findOne({ userId: user.userId });

    if (!userSettings || !userSettings.hrmsPasswordEncrypted) {
      return NextResponse.json({ error: "HRMS credentials not configured" }, { status: 400 });
    }

    const password = decrypt(
      userSettings.hrmsPasswordEncrypted,
      userSettings.hrmsPasswordIv,
      userSettings.hrmsPasswordTag
    );

    const session = await hrmsLogin(userSettings.hrmsEmail, password);
    const state = await hrmsGetState(session);

    const action = logType === "IN" ? "CHECK_IN" : "CHECK_OUT";

    if (logType === "IN" && state.checkins.some((c) => c.log_type === "IN")) {
      return NextResponse.json({ error: "Already checked in today" }, { status: 409 });
    }

    if (logType === "OUT" && state.checkins.some((c) => c.log_type === "OUT")) {
      return NextResponse.json({ error: "Already checked out today" }, { status: 409 });
    }

    if (logType === "OUT" && !state.checkins.some((c) => c.log_type === "IN")) {
      return NextResponse.json({ error: "Cannot check out without checking in first" }, { status: 400 });
    }

    const result = await hrmsCheckin(
      session,
      userSettings.latitude,
      userSettings.longitude,
      logType
    );

    await insertLog({
      userId: user.userId,
      action,
      status: result.success ? "SUCCESS" : "FAILED",
      scheduledAt: new Date(),
      executedAt: new Date(),
      responseData: result.raw as Record<string, unknown>,
      errorMessage: result.success ? undefined : "HRMS returned failure",
    });

    if (!result.success) {
      return NextResponse.json({ error: "HRMS check-in failed", details: result.raw }, { status: 502 });
    }

    return NextResponse.json({ success: true, time: result.time });
  } catch (err) {
    console.error("[API /checkin POST]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
