import { NextRequest, NextResponse } from "next/server";
import { insertUser } from "@/lib/models/user";
import { verifyInvite, consumeInvite } from "@/lib/models/invite";
import { signToken, getAuthCookie } from "@/lib/auth";
import { emailIsTaken, hashPassword, normalizeEmail, validatePassword } from "@/lib/account";

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail, password, name, invite } = await req.json();
    const email = normalizeEmail(rawEmail);

    if (!email || !password || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "email, password, and name are required" },
        { status: 400 }
      );
    }

    // Registration is invite-only: an admin issues a single-use token bound to
    // one address, so an open URL alone can no longer create an account that
    // stores HRMS credentials.
    const check = await verifyInvite(invite);
    if (!check.valid) {
      return NextResponse.json({ error: check.reason }, { status: 403 });
    }
    if (check.email !== email) {
      return NextResponse.json(
        { error: "This invite is for a different email address" },
        { status: 403 }
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    if (await emailIsTaken(email)) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Burn the token before creating the account: if two submits race, only one
    // wins the claim and the loser is rejected rather than creating a duplicate.
    if (!(await consumeInvite(invite))) {
      return NextResponse.json(
        { error: "This invite link has already been used" },
        { status: 403 }
      );
    }

    const passwordHash = await hashPassword(password);
    const result = await insertUser({
      email,
      passwordHash,
      name: name.trim(),
      createdAt: new Date(),
    });

    const token = signToken({
      userId: result._id,
      email,
      name: result.name,
      role: "user",
    });

    const res = NextResponse.json({ success: true, name: result.name, email });
    res.cookies.set(getAuthCookie(token));
    return res;
  } catch (err) {
    console.error("[API /auth/register]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
