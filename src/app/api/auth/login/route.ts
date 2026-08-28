import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken, getAuthCookie } from "@/lib/auth";
import { findUserByEmail, normalizeEmail } from "@/lib/account";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email);
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    // Case-insensitive so accounts created before email normalization, with
    // whatever casing was typed, still sign in.
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = signToken({
      userId: user._id,
      email: user.email,
      name: user.name,
      role: user.role || "user",
    });

    const res = NextResponse.json({ success: true, name: user.name, email: user.email });
    res.cookies.set(getAuthCookie(token));
    return res;
  } catch (err) {
    console.error("[API /auth/login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
