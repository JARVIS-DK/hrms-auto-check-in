import { NextRequest, NextResponse } from "next/server";
import { verifyInvite } from "@/lib/models/invite";

/**
 * Lets the registration page resolve a token to the address it authorizes, so
 * the email field can be pre-filled and locked. Public by necessity — the
 * token itself is the credential.
 */
export async function GET(req: NextRequest) {
  try {
    const result = await verifyInvite(req.nextUrl.searchParams.get("token"));
    if (!result.valid) {
      return NextResponse.json({ valid: false, reason: result.reason }, { status: 400 });
    }
    return NextResponse.json({ valid: true, email: result.email });
  } catch (err) {
    console.error("[API /auth/invite]", err);
    return NextResponse.json({ valid: false, reason: "Could not verify invite" }, { status: 500 });
  }
}
