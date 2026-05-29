import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUsersCollection } from "@/lib/models/user";
import { signToken, getAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    const users = await getUsersCollection();
    const user = await users.findOne({ email });
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
    });

    const res = NextResponse.json({ success: true, name: user.name, email: user.email });
    res.cookies.set(getAuthCookie(token));
    return res;
  } catch (err) {
    console.error("[API /auth/login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
