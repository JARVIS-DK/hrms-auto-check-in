import { NextRequest, NextResponse } from "next/server";
import { getUsersCollection } from "@/lib/models/user";
import { verifyResetToken, markTokenUsed } from "@/lib/models/password-reset";
import { EMAIL_COLLATION, findUserByEmail, hashPassword, validatePassword } from "@/lib/account";

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

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Same rules and same bcrypt cost as registration — these used to diverge
    // (6 chars / cost 10 here vs no minimum / cost 12 on register).
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const result = await verifyResetToken(token);
    if (!result.valid) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    // Case-insensitive: the token stores the normalized address, while an
    // account created before normalization may be stored with other casing.
    const user = await findUserByEmail(result.email!);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    const users = await getUsersCollection();
    await users.updateOne(
      { _id: user._id },
      // Normalize the stored address while we're here, so this account stops
      // depending on the collation fallback from now on.
      { $set: { passwordHash, email: result.email! } },
      { collation: EMAIL_COLLATION }
    );
    await markTokenUsed(token);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API /auth/reset-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
