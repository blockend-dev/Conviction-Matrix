import Anthropic from "@anthropic-ai/sdk";
import type { ConvictionSignal } from "../types";

export interface Hypothesis {
  dimension: "etf" | "treasury" | "macro";
  statement: string;
}

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// Generates 3 machine-verifiable hypotheses for a signal via Haiku.
// Each maps to one of the 3 thesis verification dimensions (etf / treasury / macro).
// Runs non-blocking — caller should fire-and-forget then UPDATE predictions when resolved.
export async function generateHypotheses(
  signal: ConvictionSignal
): Promise<Hypothesis[] | null> {
  const client = getClient();
  if (!client) return null;

  const etfFlow = signal.macro?.etfNetFlow ?? 0;
  const etfDir = etfFlow >= 0 ? "positive" : "negative";
  const btcActive = (signal.institutional?.btcTreasuryPurchases ?? 0) > 0;
  const macroScore = signal.macro?.macroScore ?? 50;
  const macroMin = Math.max(0, macroScore - 15);
  const macroMax = Math.min(100, macroScore + 15);
  const bullish = signal.direction === "STRONG_BUY" || signal.direction === "BUY";

  const prompt = `You are a crypto sector analyst generating testable market hypotheses.

Signal: ${signal.sector} sector — score ${signal.overallScore}/100 — ${signal.direction}
Current ETF net flow: ${etfDir} ($${Math.abs(etfFlow).toFixed(0)}M)
Current BTC treasury activity: ${btcActive ? "active buying" : "no purchases"}
Current macro score: ${macroScore}/100

Write exactly 3 short hypotheses (one sentence each, future tense, testable within 7 days).
Map each to one dimension. Constraints:
• etf: predict ETF flow stays ${etfDir} (within 50% of current magnitude)
• treasury: predict BTC treasury purchases will ${btcActive ? "continue (>0)" : "remain absent"}
• macro: predict macro score stays between ${macroMin} and ${macroMax}

Return ONLY a JSON array like:
[{"dimension":"etf","statement":"..."},{"dimension":"treasury","statement":"..."},{"dimension":"macro","statement":"..."}]

No markdown, no explanation — raw JSON only.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";
    // Strip any accidental markdown fences
    const json = text.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
    const parsed: Hypothesis[] = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length < 3) return null;

    const VALID_DIMS = new Set<Hypothesis["dimension"]>(["etf", "treasury", "macro"]);
    return parsed.slice(0, 3).map(h => ({
      dimension: VALID_DIMS.has(h.dimension as Hypothesis["dimension"])
        ? (h.dimension as Hypothesis["dimension"])
        : "etf",
      statement: String(h.statement ?? "").slice(0, 220),
    }));
  } catch (err) {
    console.error("[decomposer] generateHypotheses failed:", err);
    return null;
  }
}

// Derives default (deterministic) hypotheses when Haiku is unavailable,
// so the ledger always has something to display even without an API key.
export function defaultHypotheses(signal: ConvictionSignal): Hypothesis[] {
  const etfFlow = signal.macro?.etfNetFlow ?? 0;
  const etfDir = etfFlow >= 0 ? "positive" : "negative";
  const btcActive = (signal.institutional?.btcTreasuryPurchases ?? 0) > 0;
  const macroScore = signal.macro?.macroScore ?? 50;
  const macroMin = Math.max(0, macroScore - 15);
  const macroMax = Math.min(100, macroScore + 15);
  return [
    {
      dimension: "etf",
      statement: `${signal.sector} sector ETF net flow will remain ${etfDir} at T+7, confirming ${etfDir === "positive" ? "institutional accumulation" : "capital rotation"} thesis.`,
    },
    {
      dimension: "treasury",
      statement: btcActive
        ? `At least one BTC treasury purchase will be recorded in the next 7 days, sustaining the ${signal.sector} corporate adoption signal.`
        : `No BTC treasury purchases will be recorded at T+7, consistent with the current ${signal.sector} institutional posture.`,
    },
    {
      dimension: "macro",
      statement: `The ${signal.sector} macro score will remain between ${macroMin} and ${macroMax} at T+7, within the ±15-point confirmation band.`,
    },
  ];
}
