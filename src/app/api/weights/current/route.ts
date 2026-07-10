import { NextResponse } from "next/server";
import { getCurrentWeights, getWeightHistory } from "@/lib/ledger/accuracy";
import { DB_AVAILABLE } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 86400; // 24h cache

export async function GET() {
  try {
    const [current, history] = await Promise.all([
      getCurrentWeights(),
      getWeightHistory(),
    ]);

    return NextResponse.json({
      current,
      history,
      ledgerEnabled: DB_AVAILABLE,
      methodology: {
        l1: "Fundraising velocity (VC capital deployed per sector)",
        l2: "Institutional accumulation (BTC treasury purchases + crypto stock momentum)",
        l3: "Macro/ETF confirmation (7-day ETF net flow + FOMC historical impact)",
        verification: "Weights are recalibrated weekly from thesis verification rates. Initial weights 30/35/35 are defaults until 20+ predictions per sector accumulate.",
        criteria: {
          etf: "ETF net flow >= 50% of original signal strength at T+7/T+30",
          treasury: "BTC purchases > 0 during horizon window",
          macro: "Macro score within 15 points of original signal",
          verified: "Thesis verified when >= 2/3 layer conditions confirm",
        },
      },
    });
  } catch (err) {
    console.error("[weights/current]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
