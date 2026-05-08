import type { Sector, FundraisingSignal, InstitutionalSignal, MacroConfirmation, ConvictionSignal } from "../types";
import { SECTOR_TOKEN_MAP } from "./sectorMap";
import {
  getFundraisingProjects, getBTCTreasuries, getBTCPurchaseHistory,
  getCryptoStocks, getStockSnapshot, getETFSummaryHistory,
  getMacroEventHistory, getSectorSpotlight,
} from "../sosovalue/client";
import {
  mockFundraising, mockBTCTreasuries, mockBTCPurchases, mockStockSnapshots,
  mockETFHistory, mockMacroHistory, mockSectorData,
} from "../sosovalue/mock";

const USE_MOCK = !process.env.SOSOVALUE_API_KEY || process.env.SOSOVALUE_API_KEY === "your_sosovalue_api_key_here";

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

// ── Layer 1: Fundraising ─────────────────────────────────────────────────────

export async function computeFundraisingSignal(sector: Sector): Promise<FundraisingSignal> {
  const projects = USE_MOCK
    ? mockFundraising
    : await safe(() => getFundraisingProjects(100), mockFundraising);

  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const relevant = projects.filter(p => p.sector.toUpperCase() === sector.toUpperCase());
  const recent = relevant.filter(p => now - new Date(p.date).getTime() < thirtyDays);

  const totalRaised = recent.reduce((s, p) => s + (p.amount ?? 0), 0);
  const recentRounds = recent.length;

  // Momentum: weighted score (recency + amount + round count)
  let momentum = 0;
  if (recentRounds > 0) {
    const amountScore = Math.min(100, (totalRaised / 50_000_000) * 50);  // $50M = 50pts
    const countScore = Math.min(50, recentRounds * 10);                  // 5+ rounds = 50pts
    momentum = Math.round(amountScore + countScore);
  }

  return {
    sector,
    projectCount: relevant.length,
    totalRaised,
    recentRounds,
    momentum,
    projects: recent.slice(0, 5).map(p => ({
      name: p.name, amount: p.amount, date: p.date, stage: p.stage,
    })),
  };
}

// ── Layer 2: Institutional accumulation ─────────────────────────────────────

export async function computeInstitutionalSignal(sector: Sector): Promise<InstitutionalSignal> {
  const treasuries = USE_MOCK
    ? mockBTCTreasuries
    : await safe(() => getBTCTreasuries(), mockBTCTreasuries);

  // BTC treasury recent purchases (use MSTR as proxy for institutional sentiment)
  const purchases = USE_MOCK
    ? mockBTCPurchases
    : await safe(() => getBTCPurchaseHistory("MSTR", 10), mockBTCPurchases);

  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const recentPurchases = purchases.filter(p => now - new Date(p.date).getTime() < thirtyDays);
  const recentBTC = recentPurchases.reduce((s, p) => s + p.amount, 0);

  // Crypto stock momentum for BTC-adjacent sectors
  const stockTickers = ["MSTR", "COIN", "MARA", "RIOT"];
  const stockChanges: number[] = [];
  for (const ticker of stockTickers) {
    const snap = USE_MOCK
      ? mockStockSnapshots[ticker]
      : await safe(() => getStockSnapshot(ticker), mockStockSnapshots[ticker]);
    if (snap?.change) stockChanges.push(snap.change);
  }
  const avgStockMomentum = stockChanges.length
    ? stockChanges.reduce((a, b) => a + b, 0) / stockChanges.length
    : 0;

  // Institutional score
  const btcScore = Math.min(50, (recentBTC / 5000) * 50);          // 5000 BTC bought = 50pts
  const stockScore = Math.min(50, Math.max(0, avgStockMomentum * 5)); // 10% avg gain = 50pts
  const institutionalScore = Math.round(btcScore + stockScore);

  return {
    sector,
    btcTreasuryPurchases: recentBTC,
    btcCompanyCount: treasuries.length,
    cryptoStockMomentum: avgStockMomentum,
    institutionalScore,
    companies: treasuries.slice(0, 4).map(t => ({
      name: t.name, ticker: t.ticker,
      action: recentPurchases.length > 0 ? "BUY" : "HOLD",
      amount: recentPurchases[0]?.amount,
    })),
  };
}

// ── Layer 3: ETF + Macro confirmation ────────────────────────────────────────

export async function computeMacroConfirmation(): Promise<MacroConfirmation> {
  const etfHistory = USE_MOCK
    ? mockETFHistory
    : await safe(() => getETFSummaryHistory(14), mockETFHistory);

  // 7-day rolling net ETF flow
  const recent7 = etfHistory.slice(0, 7);
  const etfNetFlow = recent7.reduce((s, e) => s + e.totalNetFlow, 0);
  const etfFlowScore = Math.min(100, Math.max(0, 50 + (etfNetFlow / 100_000_000) * 10));

  // Macro event historical impact on crypto
  const fomcHistory = USE_MOCK
    ? mockMacroHistory
    : await safe(() => getMacroEventHistory("FOMC Rate Decision", 6), mockMacroHistory);

  const avgImpact = fomcHistory.length
    ? fomcHistory.reduce((s, e) => s + e.btcChange24h, 0) / fomcHistory.length
    : 0;

  const macroScore = Math.min(100, Math.max(0, 50 + avgImpact * 3));

  return {
    etfNetFlow,
    etfFlowScore: Math.round(etfFlowScore),
    upcomingEvents: [
      { name: "FOMC Rate Decision", date: "2026-05-07", historicalImpact: Math.round(avgImpact * 10) / 10 },
      { name: "US CPI", date: "2026-05-13", historicalImpact: -1.2 },
    ],
    macroScore: Math.round(macroScore),
  };
}

// ── Composite Conviction Score ───────────────────────────────────────────────

function scoreToDirection(score: number): ConvictionSignal["direction"] {
  if (score >= 75) return "STRONG_BUY";
  if (score >= 60) return "BUY";
  if (score >= 40) return "NEUTRAL";
  if (score >= 25) return "SELL";
  return "STRONG_SELL";
}

export async function computeConviction(sector: Sector): Promise<ConvictionSignal> {
  const [fundraising, institutional, macro] = await Promise.all([
    computeFundraisingSignal(sector),
    computeInstitutionalSignal(sector),
    computeMacroConfirmation(),
  ]);

  const layer1Score = fundraising.momentum;
  const layer2Score = institutional.institutionalScore;
  const layer3Score = macro.macroScore;

  // Weighted: L1 30% + L2 35% + L3 35%
  const overallScore = Math.round(
    layer1Score * 0.30 + layer2Score * 0.35 + layer3Score * 0.35
  );

  return {
    sector,
    layer1Score,
    layer2Score,
    layer3Score,
    overallScore,
    direction: scoreToDirection(overallScore),
    tokens: SECTOR_TOKEN_MAP[sector] ?? [],
    narrative: "",  // filled by Claude
    lastUpdated: new Date().toISOString(),
    fundraising,
    institutional,
    macro,
  };
}

export async function computeAllSectors(): Promise<ConvictionSignal[]> {
  const sectors: Sector[] = ["AI", "DePIN", "RWA", "DeFi", "L2", "L1", "GameFi", "Meme"];
  return Promise.all(sectors.map(computeConviction));
}
