import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAdminError } from "@/lib/middleware/adminAuth";
import { getHolidaysCollection } from "@/lib/models/holiday";
import { getNextId } from "@/lib/models/counter";
import { isValidDateString } from "@/lib/utils";

const ROUTE = "/admin/holidays";
const MAX_DATES_PER_REQUEST = 60;
const MAX_NAME_LENGTH = 100;

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    const query: Record<string, unknown> = {};
    if (isValidDateString(from) || isValidDateString(to)) {
      const range: Record<string, string> = {};
      if (isValidDateString(from)) range.$gte = from;
      if (isValidDateString(to)) range.$lte = to;
      query.date = range;
    }

    const holidays = await getHolidaysCollection();
    const docs = await holidays.find(query).sort({ date: 1 }).limit(500).toArray();

    return NextResponse.json({
      holidays: docs.map((h) => ({
        id: h._id,
        date: h.date,
        name: h.name,
        createdAt: h.createdAt,
      })),
      total: docs.length,
    });
  } catch (err) {
    return handleAdminError(ROUTE, err, { holidays: [], total: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    // Accept one date or a range/list, so a multi-day festival is one action.
    const dates: unknown[] = Array.isArray(body.dates)
      ? body.dates
      : body.date !== undefined
        ? [body.date]
        : [];

    if (!name) {
      return NextResponse.json({ error: "Holiday name is required" }, { status: 400 });
    }
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Name must be at most ${MAX_NAME_LENGTH} characters` },
        { status: 400 }
      );
    }
    if (dates.length === 0) {
      return NextResponse.json({ error: "At least one date is required" }, { status: 400 });
    }
    if (dates.length > MAX_DATES_PER_REQUEST) {
      return NextResponse.json(
        { error: `At most ${MAX_DATES_PER_REQUEST} dates per request` },
        { status: 400 }
      );
    }

    const unique = [...new Set(dates)];
    const invalid = unique.find((d) => !isValidDateString(d));
    if (invalid !== undefined) {
      return NextResponse.json(
        { error: `Invalid date: ${String(invalid).slice(0, 20)} (expected YYYY-MM-DD)` },
        { status: 400 }
      );
    }

    const holidays = await getHolidaysCollection();
    const ids = await Promise.all(unique.map(() => getNextId("holidays")));

    // Upsert so re-adding a date renames it instead of failing on the unique index.
    const result = await holidays.bulkWrite(
      unique.map((date, i) => ({
        updateOne: {
          filter: { date: date as string },
          update: {
            $set: { name },
            $setOnInsert: {
              _id: ids[i],
              date: date as string,
              createdBy: admin.userId,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    return NextResponse.json({
      success: true,
      added: result.upsertedCount,
      updated: result.modifiedCount,
    });
  } catch (err) {
    return handleAdminError(ROUTE, err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();

    const date = req.nextUrl.searchParams.get("date");
    if (!isValidDateString(date)) {
      return NextResponse.json({ error: "Valid date param required" }, { status: 400 });
    }

    const holidays = await getHolidaysCollection();
    const result = await holidays.deleteOne({ date });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "No holiday on that date" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAdminError(ROUTE, err);
  }
}
