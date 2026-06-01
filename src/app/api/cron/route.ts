import { NextResponse } from "next/server";
import { runCheckinJob } from "@/cron/checkin";
import { runCheckoutJob } from "@/cron/checkout";
import { nowIST } from "@/lib/utils";
import { format } from "date-fns";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const time = format(nowIST(), "HH:mm");
  console.log(`[CRON] Tick at ${time} IST`);

  try {
    await Promise.all([
      runCheckinJob(),
      runCheckoutJob(),
    ]);

    return NextResponse.json({ ok: true, time });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CRON] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
