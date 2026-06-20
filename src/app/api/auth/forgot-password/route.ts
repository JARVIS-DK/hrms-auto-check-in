import { NextRequest, NextResponse } from "next/server";
import { getUsersCollection } from "@/lib/models/user";
import { createResetToken } from "@/lib/models/password-reset";
import { sendResetLinkEmail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const users = await getUsersCollection();
    const user = await users.findOne({ email });

    if (!user) {
      return NextResponse.json({ error: "No account found with this email" }, { status: 400 });
    }

    const token = await createResetToken(email);
    const origin = req.nextUrl.origin;
    const resetUrl = `${origin}/reset-password?token=${token}`;
    sendResetLinkEmail(email, resetUrl);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API /auth/forgot-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
