import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getSettingsCollection, insertSettings } from "@/lib/models/settings";
import { encrypt } from "@/lib/crypto";
import { hrmsLogin } from "@/lib/hrms/client";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const settings = await getSettingsCollection();
    const doc = await settings.findOne({ userId: user.userId });

    if (!doc) {
      return NextResponse.json({
        hrmsEmail: "",
        latitude: "",
        longitude: "",
        automationEnabled: false,
        hasPassword: false,
        checkinStart: "",
        checkinEnd: "",
        checkoutStart: "",
        checkoutEnd: "",
        skipSaturday: true,
        skipSunday: true,
      });
    }

    return NextResponse.json({
      hrmsEmail: doc.hrmsEmail,
      latitude: doc.latitude,
      longitude: doc.longitude,
      automationEnabled: doc.automationEnabled,
      hasPassword: !!doc.hrmsPasswordEncrypted,
      checkinStart: doc.checkinStart || "",
      checkinEnd: doc.checkinEnd || "",
      checkoutStart: doc.checkoutStart || "",
      checkoutEnd: doc.checkoutEnd || "",
      skipSaturday: doc.skipSaturday ?? true,
      skipSunday: doc.skipSunday ?? true,
    });
  } catch (err) {
    console.error("[API /settings GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { hrmsEmail, hrmsPassword, latitude, longitude, automationEnabled, checkinStart, checkinEnd, checkoutStart, checkoutEnd, skipSaturday, skipSunday } = body;

    const settings = await getSettingsCollection();
    const userId = user.userId;
    const existing = await settings.findOne({ userId });

    const update: Record<string, unknown> = {
      userId,
      hrmsEmail: hrmsEmail ?? existing?.hrmsEmail ?? "",
      latitude: latitude ?? existing?.latitude ?? "",
      longitude: longitude ?? existing?.longitude ?? "",
      automationEnabled: automationEnabled ?? existing?.automationEnabled ?? false,
      checkinStart: checkinStart ?? existing?.checkinStart ?? "",
      checkinEnd: checkinEnd ?? existing?.checkinEnd ?? "",
      checkoutStart: checkoutStart ?? existing?.checkoutStart ?? "",
      checkoutEnd: checkoutEnd ?? existing?.checkoutEnd ?? "",
      skipSaturday: skipSaturday ?? existing?.skipSaturday ?? true,
      skipSunday: skipSunday ?? existing?.skipSunday ?? true,
      updatedAt: new Date(),
    };

    if (hrmsPassword) {
      try {
        await hrmsLogin(update.hrmsEmail as string, hrmsPassword);
      } catch {
        return NextResponse.json({ error: "Invalid HRMS credentials. Login failed." }, { status: 422 });
      }
      const { encrypted, iv, tag } = encrypt(hrmsPassword);
      update.hrmsPasswordEncrypted = encrypted;
      update.hrmsPasswordIv = iv;
      update.hrmsPasswordTag = tag;
    } else if (existing) {
      update.hrmsPasswordEncrypted = existing.hrmsPasswordEncrypted;
      update.hrmsPasswordIv = existing.hrmsPasswordIv;
      update.hrmsPasswordTag = existing.hrmsPasswordTag;
    }

    if (existing) {
      await settings.updateOne({ userId }, { $set: update });
    } else {
      await insertSettings({
        ...update,
        createdAt: new Date(),
      } as any);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API /settings PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
