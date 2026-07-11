import { NextRequest, NextResponse } from "next/server";
import { DB_AVAILABLE } from "@/lib/db";
import { calibrateWeights } from "@/lib/ledger/accuracy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Weekly calibration cron: derives per-sector L1/L2/L3 weights from verified predictions.
// Auth: Authorization: Bearer $CRON_SECRET header OR ?secret= query param.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const querySecret = req.nextUrl.searchParams.get("secret") ?? "";

  const authorized =
    (secret && authHeader === `Bearer ${secret}`) ||
    (secret && querySecret === secret);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!DB_AVAILABLE) {
    return NextResponse.json({ skipped: true, reason: "POSTGRES_URL not configured" });
  }

  const t0 = Date.now();
  try {
    await calibrateWeights();
    return NextResponse.json({ ok: true, elapsed: Date.now() - t0 });
  } catch (err) {
    console.error("[calibrate] route error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
