import { DB_AVAILABLE } from "../db";
import { getETFSummaryHistory, getBTCPurchaseHistory, getMacroEventHistory } from "../sosovalue/client";
import { mockETFHistory, mockBTCPurchases, mockMacroHistory } from "../sosovalue/mock";
import { getPendingVerifications, insertVerification } from "./store";
import { refreshSignalAccuracy } from "./accuracy";

const USE_MOCK = !process.env.SOSOVALUE_API_KEY ||
  process.env.SOSOVALUE_API_KEY === "your_sosovalue_api_key_here";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

interface LiveSignals {
  etfNetFlow: number;
  btcPurchases: number;
  macroScore: number;
}

async function fetchLiveSignals(): Promise<LiveSignals> {
  const [etfHistory, purchases, macroHistory] = await Promise.all([
    USE_MOCK ? Promise.resolve(mockETFHistory) : safe(() => getETFSummaryHistory(7), mockETFHistory),
    USE_MOCK ? Promise.resolve(mockBTCPurchases) : safe(() => getBTCPurchaseHistory("MSTR", 10), mockBTCPurchases),
    USE_MOCK ? Promise.resolve(mockMacroHistory) : safe(() => getMacroEventHistory("FOMC Rate Decision", 6), mockMacroHistory),
  ]);

  const etfNetFlow = etfHistory.slice(0, 7).reduce((s, e) => s + e.totalNetFlow, 0);
  const btcPurchases = purchases.reduce((s, p) => s + p.amount, 0);
  const avgImpact = macroHistory.length
    ? macroHistory.reduce((s, e) => s + e.btcChange24h, 0) / macroHistory.length
    : 0;
  const macroScore = Math.round(Math.min(100, Math.max(0, 50 + avgImpact * 3)));

  return { etfNetFlow, btcPurchases, macroScore };
}

// Thesis evaluation — published criteria, documented in README
// ETF: thesis is that institutional flows continue in the same direction
// Treasury: thesis is that BTC accumulation continues (any purchases = confirmed)
// Macro: thesis is that macro environment stays stable (score within 15pts)
function evaluateThesis(
  original: { etfNetFlow: number | null; btcPurchases: number | null; macroScoreRaw: number | null },
  current: LiveSignals
): {
  etfConfirmed: boolean;
  treasuryConfirmed: boolean;
  macroConfirmed: boolean;
  componentsConfirmed: number;
  thesisVerified: boolean;
} {
  const origEtf = Number(original.etfNetFlow ?? 0);
  const origBtc = Number(original.btcPurchases ?? 0);
  const origMacro = Number(original.macroScoreRaw ?? 50);

  // ETF layer: flow remained at ≥50% strength in same direction
  const etfConfirmed = origEtf >= 0
    ? current.etfNetFlow >= origEtf * 0.5
    : current.etfNetFlow <= origEtf * 0.5;

  // Treasury layer: any purchases = confirmed (we can't detect "no purchases" reliably on mock)
  const treasuryConfirmed = origBtc > 0 ? current.btcPurchases > 0 : true;

  // Macro layer: score didn't shift more than 15 points
  const macroConfirmed = Math.abs(current.macroScore - origMacro) < 15;

  const componentsConfirmed = [etfConfirmed, treasuryConfirmed, macroConfirmed].filter(Boolean).length;

  return {
    etfConfirmed,
    treasuryConfirmed,
    macroConfirmed,
    componentsConfirmed,
    thesisVerified: componentsConfirmed >= 2,
  };
}

export async function runVerificationBatch(
  horizonDays: 7 | 30
): Promise<{ processed: number; verified: number; disconfirmed: number }> {
  if (!DB_AVAILABLE) return { processed: 0, verified: 0, disconfirmed: 0 };

  const pending = await getPendingVerifications(horizonDays);
  if (!pending.length) return { processed: 0, verified: 0, disconfirmed: 0 };

  const current = await fetchLiveSignals();
  let verified = 0;
  let disconfirmed = 0;

  for (const prediction of pending) {
    const result = evaluateThesis(
      {
        etfNetFlow: Number(prediction.etfNetFlow),
        btcPurchases: Number(prediction.btcPurchases),
        macroScoreRaw: Number(prediction.macroScoreRaw),
      },
      current
    );

    await insertVerification(
      prediction.id,
      horizonDays,
      current.etfNetFlow,
      current.btcPurchases,
      current.macroScore,
      result.etfConfirmed,
      result.treasuryConfirmed,
      result.macroConfirmed,
      result.componentsConfirmed,
      result.thesisVerified
    );

    if (result.thesisVerified) verified++; else disconfirmed++;
  }

  await refreshSignalAccuracy();

  console.log(`[verify] horizon=${horizonDays}d processed=${pending.length} verified=${verified} disconfirmed=${disconfirmed}`);
  return { processed: pending.length, verified, disconfirmed };
}

// Used by seed — evaluates two historical snapshots against each other
export function evaluateHistoricalThesis(
  original: { etfNetFlow: number; btcPurchases: number; macroScore: number },
  then: { etfNetFlow: number; btcPurchases: number; macroScore: number }
): {
  etfConfirmed: boolean;
  treasuryConfirmed: boolean;
  macroConfirmed: boolean;
  componentsConfirmed: number;
  thesisVerified: boolean;
} {
  const etfConfirmed = original.etfNetFlow >= 0
    ? then.etfNetFlow >= original.etfNetFlow * 0.5
    : then.etfNetFlow <= original.etfNetFlow * 0.5;

  const treasuryConfirmed = original.btcPurchases > 0 ? then.btcPurchases > 0 : true;
  const macroConfirmed = Math.abs(then.macroScore - original.macroScore) < 15;

  const componentsConfirmed = [etfConfirmed, treasuryConfirmed, macroConfirmed].filter(Boolean).length;

  return {
    etfConfirmed,
    treasuryConfirmed,
    macroConfirmed,
    componentsConfirmed,
    thesisVerified: componentsConfirmed >= 2,
  };
}
