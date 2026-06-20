import { NextRequest, NextResponse } from "next/server";
import { getUsersCollection } from "@/lib/models/user";
import { createOtp } from "@/lib/models/password-reset";
import { sendOtpEmail } from "@/lib/mail";

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
      // Don't reveal whether the email exists
      return NextResponse.json({ success: true });
    }

    const otp = await createOtp(email);
    sendOtpEmail(email, otp);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API /auth/forgot-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
