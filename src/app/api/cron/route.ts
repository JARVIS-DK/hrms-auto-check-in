import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { runAttendanceTick } from "@/cron/attendance";
import { ensureIndexes } from "@/lib/models/indexes";
import { nowIST } from "@/lib/utils";
import { format } from "date-fns";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[CRON] CRON_SECRET is not set — refusing to run");
    return false;
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const time = format(nowIST(), "HH:mm");

  try {
    // Idempotent and memoized per process — keeps the unique index that makes
    // the scheduling claims safe present after any deploy or database reset.
    await ensureIndexes();

    const { due, users } = await runAttendanceTick();
    return NextResponse.json({ ok: true, time, due, users });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CRON] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
