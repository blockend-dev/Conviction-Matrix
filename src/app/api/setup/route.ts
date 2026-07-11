// One-time setup: runs DB migration + seeds historical data.
// Call once after adding POSTGRES_URL to env: GET /api/setup?secret=<CRON_SECRET>
// Add ?reset=true to wipe existing predictions and re-seed from scratch.
import { NextRequest, NextResponse } from "next/server";
import { migrate, DB_AVAILABLE, sql } from "@/lib/db";
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

  const reset = req.nextUrl.searchParams.get("reset") === "true";

  try {
    await migrate();

    if (reset) {
      await sql`DELETE FROM verifications`;
      await sql`DELETE FROM predictions`;
      await sql`DELETE FROM signal_accuracy`;
      console.log("[setup] reset — tables cleared");
    }

    const seedResult = await seedHistoricalData(reset);
    return NextResponse.json({
      ok: true,
      migration: "complete",
      reset,
      seed: seedResult,
      message: "DB ready. Historical data seeded. Conviction calls now log automatically.",
    });
  } catch (err) {
    console.error("[setup] failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
