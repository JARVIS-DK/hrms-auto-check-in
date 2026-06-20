import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUsersCollection } from "@/lib/models/user";
import { verifyResetToken, markTokenUsed } from "@/lib/models/password-reset";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const result = await verifyResetToken(token);
    if (!result.valid) {
      return NextResponse.json({ valid: false, reason: result.reason }, { status: 400 });
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error("[API /auth/reset-password GET]", err);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Token and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const result = await verifyResetToken(token);
    if (!result.valid) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    const users = await getUsersCollection();
    const user = await users.findOne({ email: result.email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await users.updateOne({ email: result.email }, { $set: { passwordHash } });
    await markTokenUsed(token);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API /auth/reset-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
