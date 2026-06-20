import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getGlobalDefaults } from "@/lib/models/global-settings";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const defaults = await getGlobalDefaults();
  return NextResponse.json({
    checkinStart: defaults.checkinStart,
    checkinEnd: defaults.checkinEnd,
    checkoutStart: defaults.checkoutStart,
    checkoutEnd: defaults.checkoutEnd,
  });
}
