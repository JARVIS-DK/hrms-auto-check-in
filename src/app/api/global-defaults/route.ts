import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getGlobalDefaults } from "@/lib/models/global-settings";

/**
 * Read-only view of the same defaults `/api/admin/global-settings` manages,
 * for any signed-in user — the settings page shows them as placeholders for
 * the windows a user hasn't overridden.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(await getGlobalDefaults());
  } catch (err) {
    console.error("[API /global-defaults]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
