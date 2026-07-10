// One-time setup: runs DB migration + seeds historical data.
// Call once after adding POSTGRES_URL to env: GET /api/setup?secret=<CRON_SECRET>
import { NextRequest, NextResponse } from "next/server";
import { migrate, DB_AVAILABLE } from "@/lib/db";
import { seedHistoricalData } from "@/lib/ledger/seed";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "POSTGRES_URL not set" }, { status: 503 });
  }

  try {
    await migrate();
    const seedResult = await seedHistoricalData();
    return NextResponse.json({
      ok: true,
      migration: "complete",
      seed: seedResult,
      message: "DB ready. Historical data seeded. Conviction calls now log automatically.",
    });
  } catch (err) {
    console.error("[setup] failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
