import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getLeavesCollection, insertLeave } from "@/lib/models/leave";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const leaves = await getLeavesCollection();
    const docs = await leaves
      .find({ userId: user.userId })
      .sort({ date: 1 })
      .toArray();

    return NextResponse.json(docs.map((d) => ({ date: d.date, reason: d.reason })));
  } catch (err) {
    console.error("[API /leaves GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { dates, reason } = body;

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: "dates array is required" }, { status: 400 });
    }

    const leaves = await getLeavesCollection();
    const userId = user.userId;

    let added = 0;
    for (const date of dates) {
      const exists = await leaves.findOne({ userId, date });
      if (!exists) {
        await insertLeave({ userId, date, reason: reason || undefined, createdAt: new Date() });
        added++;
      }
    }

    return NextResponse.json({ success: true, count: added });
  } catch (err) {
    console.error("[API /leaves POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "date param required" }, { status: 400 });
    }

    const leaves = await getLeavesCollection();
    await leaves.deleteOne({ userId: user.userId, date });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API /leaves DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
