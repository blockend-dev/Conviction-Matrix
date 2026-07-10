// Cron: runs thesis verification for all pending predictions past T+7 and T+30.
// Vercel Cron calls this every 4 hours. Also callable manually with secret.
import { NextRequest, NextResponse } from "next/server";
import { runVerificationBatch } from "@/lib/ledger/verify";
import { DB_AVAILABLE } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = req.nextUrl.searchParams.get("secret");
  const authorized =
    (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) ||
    (process.env.CRON_SECRET && secret === process.env.CRON_SECRET);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!DB_AVAILABLE) {
    return NextResponse.json({ error: "POSTGRES_URL not set" }, { status: 503 });
  }

  try {
    const [result7, result30] = await Promise.all([
      runVerificationBatch(7),
      runVerificationBatch(30),
    ]);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      horizon7: result7,
      horizon30: result30,
      total: {
        processed: result7.processed + result30.processed,
        verified: result7.verified + result30.verified,
        disconfirmed: result7.disconfirmed + result30.disconfirmed,
      },
    });
  } catch (err) {
    console.error("[verify/run]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
