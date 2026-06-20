import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/adminAuth";
import { getGlobalSettingsCollection, getGlobalDefaults } from "@/lib/models/global-settings";

export async function GET() {
  try {
    await requireAdmin();
    const defaults = await getGlobalDefaults();
    return NextResponse.json(defaults);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { checkinStart, checkinEnd, checkoutStart, checkoutEnd } = body;

    if (checkinStart && checkinEnd && checkinStart >= checkinEnd) {
      return NextResponse.json({ error: "Check-in start must be before end" }, { status: 400 });
    }
    if (checkoutStart && checkoutEnd && checkoutStart >= checkoutEnd) {
      return NextResponse.json({ error: "Check-out start must be before end" }, { status: 400 });
    }

    const col = await getGlobalSettingsCollection();
    await col.updateOne(
      { _id: "global" },
      {
        $set: {
          checkinStart: checkinStart || "09:30",
          checkinEnd: checkinEnd || "10:00",
          checkoutStart: checkoutStart || "19:30",
          checkoutEnd: checkoutEnd || "20:00",
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
