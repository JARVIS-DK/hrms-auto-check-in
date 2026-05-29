import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUsersCollection, insertUser } from "@/lib/models/user";
import { signToken, getAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "email, password, and name are required" },
        { status: 400 }
      );
    }

    const users = await getUsersCollection();
    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await insertUser({
      email,
      passwordHash,
      name,
      createdAt: new Date(),
    });

    const token = signToken({
      userId: result._id,
      email,
      name,
    });

    const res = NextResponse.json({ success: true, name, email });
    res.cookies.set(getAuthCookie(token));
    return res;
  } catch (err) {
    console.error("[API /auth/register]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
