import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(user);
  } catch (err) {
    console.error("[API /auth/me]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
