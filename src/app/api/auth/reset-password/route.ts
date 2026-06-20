import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUsersCollection } from "@/lib/models/user";
import { verifyOtp } from "@/lib/models/password-reset";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email?.toLowerCase().trim();
    const otp = body.otp;
    const newPassword = body.newPassword;

    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { error: "Email, OTP, and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const result = await verifyOtp(email, otp);
    if (!result.valid) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    const users = await getUsersCollection();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await users.updateOne({ email }, { $set: { passwordHash } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API /auth/reset-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
