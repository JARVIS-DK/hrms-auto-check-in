import { NextRequest, NextResponse } from "next/server";
import { createResetToken } from "@/lib/models/password-reset";
import { sendResetLinkEmail } from "@/lib/mail";
import { findUserByEmail, isValidEmail, normalizeEmail } from "@/lib/account";

/**
 * Always answers the same way.
 *
 * Reporting "no account found" turned this endpoint into a membership oracle:
 * anyone could test addresses against it and learn who has an account here.
 */
const ACCEPTED = { success: true } as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email);

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (user) {
      const token = await createResetToken(user.email);
      const resetUrl = `${req.nextUrl.origin}/reset-password?token=${token}`;
      await sendResetLinkEmail(user.email, resetUrl);
    } else {
      console.log("[API /auth/forgot-password] reset requested for unknown address");
    }

    return NextResponse.json(ACCEPTED);
  } catch (err) {
    console.error("[API /auth/forgot-password]", err);
    // Even the failure path stays uniform — a 500 here would still distinguish
    // some addresses from others.
    return NextResponse.json(ACCEPTED);
  }
}
