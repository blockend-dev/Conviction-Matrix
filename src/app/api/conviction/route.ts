import { NextResponse } from "next/server";
import { computeAllSectors } from "@/lib/conviction/engine";
import { generateAllNarratives } from "@/lib/claude";
import { insertPrediction } from "@/lib/ledger/store";
import { getSignalConfidence } from "@/lib/ledger/accuracy";
import { DB_AVAILABLE } from "@/lib/db";

export const dynamic = "force-dynamic";

const USE_MOCK = !process.env.SOSOVALUE_API_KEY ||
  process.env.SOSOVALUE_API_KEY === "your_sosovalue_api_key_here";

export async function GET() {
  try {
    const signals = await computeAllSectors();

    // Log every conviction call to the prediction ledger (non-blocking)
    if (DB_AVAILABLE) {
      Promise.allSettled(signals.map(s => insertPrediction(s))).catch(() => {});
    }

    // Attach historical accuracy confidence to each signal
    const withConfidence = DB_AVAILABLE
      ? await Promise.all(
          signals.map(async s => {
            const confidence = await getSignalConfidence(s.sector, 7);
            return { ...s, confidence };
          })
        )
      : signals.map(s => ({ ...s, confidence: null }));

    const withNarratives = process.env.ANTHROPIC_API_KEY
      ? await generateAllNarratives(withConfidence)
      : withConfidence;

    console.log(
      "[conviction] scores:",
      withNarratives.map(s => `${s.sector}:${s.overallScore}`).join(" ")
    );

    return NextResponse.json({
      signals: withNarratives,
      timestamp: new Date().toISOString(),
      source: USE_MOCK ? "mock" : "live",
      aiNarratives: !!process.env.ANTHROPIC_API_KEY,
      ledgerEnabled: DB_AVAILABLE,
    });
  } catch (err) {
    console.error("Conviction engine error:", err);
    return NextResponse.json({ error: "Engine failed", detail: String(err) }, { status: 500 });
  }
}
