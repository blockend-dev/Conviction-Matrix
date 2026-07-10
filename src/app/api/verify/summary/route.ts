import { NextResponse } from "next/server";
import { getAllAccuracy } from "@/lib/ledger/accuracy";
import { getRecentPredictions, getPredictionCount } from "@/lib/ledger/store";
import { DB_AVAILABLE } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1 hour cache

export async function GET() {
  try {
    const [accuracy, predictions, total] = await Promise.all([
      getAllAccuracy(),
      getRecentPredictions(60),
      getPredictionCount(),
    ]);

    return NextResponse.json({
      accuracy,
      predictions,
      total,
      ledgerEnabled: DB_AVAILABLE,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[verify/summary]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
