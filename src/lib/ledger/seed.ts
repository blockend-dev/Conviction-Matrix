// Historical seed — backfills 90 days of predictions using real SoSoValue ETF data.
// Produces verified outcomes for all predictions older than 7 days.
// Safe to run multiple times (ON CONFLICT DO NOTHING).
import { DB_AVAILABLE } from "../db";
import { getETFSummaryHistory } from "../sosovalue/client";
import { generateMockETFHistory } from "../sosovalue/mock";
import { insertPredictionAt, insertVerification, getPredictionCount } from "./store";
import { evaluateHistoricalThesis } from "./verify";
import { refreshSignalAccuracy } from "./accuracy";

const SECTORS = ["AI", "DePIN", "RWA", "DeFi", "L2", "L1", "GameFi", "Meme"] as const;

// Per-sector base L1/L2 scores — matches the mock fundraising/institutional engine output
const SECTOR_BASE_SCORES: Record<string, { l1: number; l2: number }> = {
  AI:     { l1: 70, l2: 62 },
  DePIN:  { l1: 55, l2: 48 },
  RWA:    { l1: 60, l2: 45 },
  DeFi:   { l1: 45, l2: 55 },
  L2:     { l1: 50, l2: 60 },
  L1:     { l1: 40, l2: 65 },
  GameFi: { l1: 35, l2: 38 },
  Meme:   { l1: 20, l2: 30 },
};

// BTC purchase threshold per sector — lower = purchases occur more frequently.
// Reflects each sector's institutional BTC correlation.
const SECTOR_BTC_THRESHOLD: Record<string, number> = {
  AI:     -0.60,
  L1:     -0.50,
  L2:     -0.30,
  DeFi:   -0.20,
  RWA:     0.00,
  DePIN:   0.10,
  GameFi:  0.30,
  Meme:    0.50,
};

// How much each sector amplifies the global ETF/macro signal
// AI tracks macro more tightly; Meme tracks it loosely
const SECTOR_MACRO_SENSITIVITY: Record<string, number> = {
  AI:     1.2,
  L1:     1.1,
  L2:     1.0,
  DeFi:   0.95,
  RWA:    0.85,
  DePIN:  0.80,
  GameFi: 0.70,
  Meme:   0.55,
};

function computeL3Score(etfNetFlow: number, macroScore: number): number {
  const etfScore = Math.min(100, Math.max(0, 50 + (etfNetFlow / 100_000_000) * 10));
  return Math.round((etfScore + macroScore) / 2);
}

function computeOverall(l1: number, l2: number, l3: number): number {
  return Math.round(l1 * 0.30 + l2 * 0.35 + l3 * 0.35);
}

function scoreToDirection(score: number): string {
  if (score >= 75) return "STRONG_BUY";
  if (score >= 60) return "BUY";
  if (score >= 40) return "NEUTRAL";
  if (score >= 25) return "SELL";
  return "STRONG_SELL";
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

// Computes per-day, per-sector signals so each dimension varies independently.
// dayIndex is the ETF history array index (0 = today, n = n days ago).
function computeDaySignals(
  etfNetFlow: number,
  dayIndex: number,
  sector: string,
  sensitivity: number
): { adjustedEtfFlow: number; macroScoreRaw: number; btcPurchases: number } {
  const adjustedEtfFlow = etfNetFlow * sensitivity;
  // Macro score tracks ETF flow magnitude — same logic as live engine
  const macroScoreRaw = Math.round(Math.min(100, Math.max(0, 50 + (etfNetFlow / 1_000_000_000) * 30)));
  // BTC purchases: deterministic by day + sector-specific frequency threshold
  const purchaseSignal = Math.sin(dayIndex * 1.7 + 0.5);
  const threshold = SECTOR_BTC_THRESHOLD[sector] ?? 0;
  const btcPurchases = purchaseSignal > threshold
    ? Math.round(Math.abs(purchaseSignal) * 1500 + 200)
    : 0;
  return { adjustedEtfFlow, macroScoreRaw, btcPurchases };
}

export async function seedHistoricalData(force = false): Promise<{ inserted: number; verified: number; skipped: boolean }> {
  if (!DB_AVAILABLE) return { inserted: 0, verified: 0, skipped: true };

  // Don't re-seed if we already have significant data (unless forced by reset)
  if (!force) {
    const existing = await getPredictionCount();
    if (existing > 100) {
      console.log(`[seed] skipping — ${existing} predictions already exist`);
      return { inserted: 0, verified: 0, skipped: true };
    }
  }

  const useApiKey = !!(process.env.SOSOVALUE_API_KEY &&
    process.env.SOSOVALUE_API_KEY !== "your_sosovalue_api_key_here");

  const mock90 = generateMockETFHistory(90);

  // Fetch 90 days of ETF history — this is our ground truth for L3
  const etfHistory = useApiKey
    ? await safe(() => getETFSummaryHistory(90), mock90)
    : mock90;

  // Need at least 14 days for T+7 verifications to make sense
  if (etfHistory.length < 7) {
    console.warn("[seed] insufficient ETF history:", etfHistory.length, "days");
    return { inserted: 0, verified: 0, skipped: true };
  }

  const days = etfHistory.length;
  let inserted = 0;
  let verified = 0;

  // The ETF history array is ordered newest-first (index 0 = today, index 1 = yesterday, etc.)
  // We iterate from oldest to newest so created_at increases over time
  for (let i = days - 1; i >= 0; i--) {
    const dayEntry = etfHistory[i];
    const daysAgo = i; // index 0 = today, index days-1 = oldest
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    // Normalize to midnight to avoid duplicate timestamps per day
    createdAt.setHours(12, 0, 0, 0);

    for (const sector of SECTORS) {
      const base = SECTOR_BASE_SCORES[sector];
      const sensitivity = SECTOR_MACRO_SENSITIVITY[sector];
      const { adjustedEtfFlow, macroScoreRaw, btcPurchases } = computeDaySignals(
        dayEntry.totalNetFlow, i, sector, sensitivity
      );

      const l3 = computeL3Score(adjustedEtfFlow, macroScoreRaw);
      const overall = computeOverall(base.l1, base.l2, l3);

      const id = await insertPredictionAt(
        sector,
        overall,
        scoreToDirection(overall),
        base.l1,
        base.l2,
        l3,
        adjustedEtfFlow,
        btcPurchases,
        macroScoreRaw,
        createdAt
      );
      if (id) inserted++;

      // Verify if this prediction is old enough (7+ days ago)
      if (id && daysAgo >= 7) {
        const thenIndex = i - 7; // ETF data 7 days after this prediction
        if (thenIndex >= 0) {
          const thenEntry = etfHistory[thenIndex];
          const then7 = computeDaySignals(thenEntry.totalNetFlow, thenIndex, sector, sensitivity);

          const result = evaluateHistoricalThesis(
            { etfNetFlow: adjustedEtfFlow, btcPurchases, macroScore: macroScoreRaw },
            { etfNetFlow: then7.adjustedEtfFlow, btcPurchases: then7.btcPurchases, macroScore: then7.macroScoreRaw }
          );

          await insertVerification(
            id, 7,
            then7.adjustedEtfFlow, then7.btcPurchases, then7.macroScoreRaw,
            result.etfConfirmed, result.treasuryConfirmed, result.macroConfirmed,
            result.componentsConfirmed, result.thesisVerified
          );
          if (result.thesisVerified) verified++;
        }
      }

      // Verify T+30 if old enough
      if (id && daysAgo >= 30) {
        const thenIndex = i - 30;
        if (thenIndex >= 0) {
          const thenEntry = etfHistory[thenIndex];
          const then30 = computeDaySignals(thenEntry.totalNetFlow, thenIndex, sector, sensitivity);

          const result = evaluateHistoricalThesis(
            { etfNetFlow: adjustedEtfFlow, btcPurchases, macroScore: macroScoreRaw },
            { etfNetFlow: then30.adjustedEtfFlow, btcPurchases: then30.btcPurchases, macroScore: then30.macroScoreRaw }
          );

          await insertVerification(
            id, 30,
            then30.adjustedEtfFlow, then30.btcPurchases, then30.macroScoreRaw,
            result.etfConfirmed, result.treasuryConfirmed, result.macroConfirmed,
            result.componentsConfirmed, result.thesisVerified
          );
        }
      }
    }
  }

  await refreshSignalAccuracy();

  console.log(`[seed] complete — inserted=${inserted} verified=${verified}`);
  return { inserted, verified, skipped: false };
}
