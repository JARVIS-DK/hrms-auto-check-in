import { NextRequest, NextResponse } from "next/server";
import { emailIsTaken, isValidEmail, normalizeEmail } from "@/lib/account";
import { getUsersCollection } from "@/lib/models/user";
import { sendAccessRequestEmail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email);

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    if (await emailIsTaken(email)) {
      return NextResponse.json({ exists: true });
    }

    const users = await getUsersCollection();
    const admins = await users
      .find({ role: "admin" }, { projection: { email: 1 } })
      .toArray();
    const adminEmails = admins.map((a) => a.email).filter(Boolean);

    if (adminEmails.length === 0) {
      return NextResponse.json(
        { error: "No admin is configured to receive this request" },
        { status: 503 }
      );
    }

    await sendAccessRequestEmail(adminEmails, email);
    return NextResponse.json({ exists: false });
  } catch (err) {
    console.error("[API /auth/contact-admin]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
