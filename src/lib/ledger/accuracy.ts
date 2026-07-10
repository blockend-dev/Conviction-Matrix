import Anthropic from "@anthropic-ai/sdk";
import { sql, DB_AVAILABLE } from "../db";

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// Calls Haiku to produce a 2-3 sentence quant-analyst reasoning note explaining
// why the weights changed for this sector. Falls back to a plain data summary.
async function generateCalibrationNote(
  sector: string,
  prevL1: number, prevL2: number, prevL3: number,
  newL1: number, newL2: number, newL3: number,
  etfAcc: number, treasuryAcc: number, macroAcc: number,
  sampleSize: number
): Promise<string> {
  const fallback =
    `Calibrated from ${sampleSize} verified predictions — ` +
    `ETF: ${(etfAcc * 100).toFixed(1)}%, ` +
    `Treasury: ${(treasuryAcc * 100).toFixed(1)}%, ` +
    `Macro: ${(macroAcc * 100).toFixed(1)}%`;

  const client = getClient();
  if (!client) return fallback;

  const prevChanged =
    Math.abs(newL1 - prevL1) > 0.005 ||
    Math.abs(newL2 - prevL2) > 0.005 ||
    Math.abs(newL3 - prevL3) > 0.005;

  const prompt = `You are a quant analyst reviewing a conviction-scoring model calibration for the ${sector} crypto sector.

Layer accuracy from ${sampleSize} verified predictions (7-day horizon):
- ETF Flow (L3 input): ${(etfAcc * 100).toFixed(1)}% confirmed
- BTC Treasury (L2 input): ${(treasuryAcc * 100).toFixed(1)}% confirmed
- Macro Score (L1 input): ${(macroAcc * 100).toFixed(1)}% confirmed

Previous weights: L1=${(prevL1*100).toFixed(1)}% · L2=${(prevL2*100).toFixed(1)}% · L3=${(prevL3*100).toFixed(1)}%
New weights:      L1=${(newL1*100).toFixed(1)}% · L2=${(newL2*100).toFixed(1)}% · L3=${(newL3*100).toFixed(1)}%

${prevChanged
  ? "Write 2 sentences explaining why these weights changed and what it implies about which signals are most predictive for this sector. Be specific — reference the accuracy numbers."
  : "Write 1 sentence explaining why the weights held steady despite the empirical data, referencing the accuracy rates."}

Be terse and analytical — no fluff, no hedge words. Plain text only.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}

export interface AccuracyStat {
  total: number;
  confirmed: number;
  rate: number;
  wilsonLower: number;
  label: "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT";
}

export interface LayerAccuracy {
  combined: AccuracyStat;
  etf: AccuracyStat;
  treasury: AccuracyStat;
  macro: AccuracyStat;
}

export interface SectorAccuracy {
  sector: string;
  horizon7: LayerAccuracy;
  horizon30: LayerAccuracy;
}

export interface ModelWeights {
  l1: number;
  l2: number;
  l3: number;
  sector: string;
  sampleSize: number;
  note: string | null;
  effectiveFrom: string;
}

// Wilson score lower bound at 95% confidence — gives a conservative accuracy estimate
function wilsonLower(successes: number, trials: number): number {
  if (trials < 5) return 0;
  const z = 1.96;
  const p = successes / trials;
  const n = trials;
  return (
    (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) /
    (1 + (z * z) / n)
  );
}

function toStat(total: number, confirmed: number): AccuracyStat {
  const t = Number(total) || 0;
  const c = Number(confirmed) || 0;
  const rate = t > 0 ? c / t : 0;
  const lower = wilsonLower(c, t);
  const label: AccuracyStat["label"] =
    t < 10 ? "INSUFFICIENT" :
    lower > 0.70 ? "HIGH" :
    lower > 0.55 ? "MODERATE" : "LOW";
  return { total: t, confirmed: c, rate, wilsonLower: lower, label };
}

const EMPTY_STAT: AccuracyStat = { total: 0, confirmed: 0, rate: 0, wilsonLower: 0, label: "INSUFFICIENT" };
const EMPTY_LAYER: LayerAccuracy = { combined: EMPTY_STAT, etf: EMPTY_STAT, treasury: EMPTY_STAT, macro: EMPTY_STAT };

export async function getAllAccuracy(): Promise<SectorAccuracy[]> {
  const sectors = ["AI", "DePIN", "RWA", "DeFi", "L2", "L1", "GameFi", "Meme"];
  if (!DB_AVAILABLE) return sectors.map(s => ({ sector: s, horizon7: EMPTY_LAYER, horizon30: EMPTY_LAYER }));

  try {
    const { rows } = await sql`
      SELECT sector, horizon_days, layer, total_calls, confirmed_calls
      FROM signal_accuracy
      WHERE sector != 'ALL'
    `;

    return sectors.map(sector => ({
      sector,
      horizon7: buildLayer(rows, sector, 7),
      horizon30: buildLayer(rows, sector, 30),
    }));
  } catch (err) {
    console.error("[accuracy] getAllAccuracy failed:", err);
    return sectors.map(s => ({ sector: s, horizon7: EMPTY_LAYER, horizon30: EMPTY_LAYER }));
  }
}

function buildLayer(rows: Record<string, unknown>[], sector: string, horizon: number): LayerAccuracy {
  const find = (layer: string) =>
    rows.find(r => r.sector === sector && Number(r.horizon_days) === horizon && r.layer === layer);
  return {
    combined: toStat(Number(find("combined")?.total_calls ?? 0), Number(find("combined")?.confirmed_calls ?? 0)),
    etf:      toStat(Number(find("etf")?.total_calls ?? 0),      Number(find("etf")?.confirmed_calls ?? 0)),
    treasury: toStat(Number(find("treasury")?.total_calls ?? 0), Number(find("treasury")?.confirmed_calls ?? 0)),
    macro:    toStat(Number(find("macro")?.total_calls ?? 0),     Number(find("macro")?.confirmed_calls ?? 0)),
  };
}

export async function getSignalConfidence(sector: string, horizonDays: 7 | 30): Promise<AccuracyStat> {
  if (!DB_AVAILABLE) return EMPTY_STAT;
  try {
    const { rows } = await sql`
      SELECT total_calls, confirmed_calls
      FROM signal_accuracy
      WHERE sector = ${sector} AND horizon_days = ${horizonDays} AND layer = 'combined'
      LIMIT 1
    `;
    if (!rows.length) return EMPTY_STAT;
    return toStat(Number(rows[0].total_calls), Number(rows[0].confirmed_calls));
  } catch {
    return EMPTY_STAT;
  }
}

export async function getCurrentWeights(): Promise<ModelWeights> {
  const defaults: ModelWeights = {
    l1: 0.30, l2: 0.35, l3: 0.35,
    sector: "ALL", sampleSize: 0,
    note: "Default weights — calibration begins after 20+ predictions per sector",
    effectiveFrom: new Date().toISOString(),
  };
  if (!DB_AVAILABLE) return defaults;
  try {
    const { rows } = await sql`
      SELECT l1_weight, l2_weight, l3_weight, sector, sample_size, calibration_note, effective_from
      FROM model_weights
      WHERE sector = 'ALL'
      ORDER BY effective_from DESC
      LIMIT 1
    `;
    if (!rows.length) return defaults;
    const r = rows[0];
    return {
      l1: Number(r.l1_weight),
      l2: Number(r.l2_weight),
      l3: Number(r.l3_weight),
      sector: r.sector as string,
      sampleSize: Number(r.sample_size),
      note: r.calibration_note as string | null,
      effectiveFrom: String(r.effective_from),
    };
  } catch {
    return defaults;
  }
}

export async function getWeightHistory(): Promise<ModelWeights[]> {
  if (!DB_AVAILABLE) return [];
  try {
    const { rows } = await sql`
      SELECT id, effective_from, sector, l1_weight, l2_weight, l3_weight, sample_size, calibration_note
      FROM model_weights
      ORDER BY effective_from DESC
      LIMIT 20
    `;
    return rows.map(r => ({
      l1: Number(r.l1_weight),
      l2: Number(r.l2_weight),
      l3: Number(r.l3_weight),
      sector: r.sector as string,
      sampleSize: Number(r.sample_size),
      note: r.calibration_note as string | null,
      effectiveFrom: String(r.effective_from),
    }));
  } catch {
    return [];
  }
}

// Derives per-sector L1/L2/L3 weights from verification accuracy rates.
// Runs only when a sector has ≥30 verified predictions at 7d horizon.
// Blends 60% empirical / 40% defaults to prevent small-sample overfitting.
export async function calibrateWeights(): Promise<void> {
  if (!DB_AVAILABLE) return;

  const sectors = ["AI", "DePIN", "RWA", "DeFi", "L2", "L1", "GameFi", "Meme", "ALL"];
  const DEFAULTS = [0.30, 0.35, 0.35]; // [l1, l2, l3]
  const MIN_SAMPLES = 30;

  for (const sector of sectors) {
    const isAll = sector === "ALL";
    const layerRows = isAll
      ? await sql`
          SELECT layer, SUM(total_calls)::int AS total, SUM(confirmed_calls)::int AS confirmed
          FROM signal_accuracy
          WHERE horizon_days = 7 AND sector != 'ALL'
          GROUP BY layer
        `
      : await sql`
          SELECT layer, total_calls AS total, confirmed_calls AS confirmed
          FROM signal_accuracy
          WHERE sector = ${sector} AND horizon_days = 7
        `;

    const find = (layer: string) =>
      layerRows.rows.find(r => r.layer === layer);

    const etfRow     = find("etf");
    const treasuryRow = find("treasury");
    const macroRow   = find("macro");

    const etfTotal = Number(etfRow?.total ?? 0);
    const treasuryTotal = Number(treasuryRow?.total ?? 0);
    const macroTotal = Number(macroRow?.total ?? 0);

    if (etfTotal < MIN_SAMPLES || treasuryTotal < MIN_SAMPLES || macroTotal < MIN_SAMPLES) continue;

    const etfAcc      = Number(etfRow!.confirmed) / etfTotal;
    const treasuryAcc = Number(treasuryRow!.confirmed) / treasuryTotal;
    const macroAcc    = Number(macroRow!.confirmed) / macroTotal;

    // Map layers: L1 ~ macro environment, L2 ~ treasury buying, L3 ~ ETF flow
    const rawArr = [macroAcc, treasuryAcc, etfAcc];
    const rawSum = rawArr.reduce((a, b) => a + b, 0);
    const normed = rawArr.map(v => v / rawSum);

    // 60% empirical, 40% defaults — dampens overfitting on moderate sample sizes
    const blended = normed.map((v, i) => v * 0.6 + DEFAULTS[i] * 0.4);
    const blendedSum = blended.reduce((a, b) => a + b, 0);
    const [l1, l2, l3] = blended.map(v =>
      Math.round((v / blendedSum) * 10000) / 10000
    );

    // Fetch previous weights for comparison (used in AI reasoning note)
    const prevWeightRows = await sql`
      SELECT l1_weight, l2_weight, l3_weight
      FROM model_weights
      WHERE sector = ${sector}
      ORDER BY effective_from DESC
      LIMIT 1
    `;
    const prev = prevWeightRows.rows[0];
    const prevL1 = prev ? Number(prev.l1_weight) : DEFAULTS[0];
    const prevL2 = prev ? Number(prev.l2_weight) : DEFAULTS[1];
    const prevL3 = prev ? Number(prev.l3_weight) : DEFAULTS[2];

    // AI-generated quant reasoning note (Haiku — falls back to plain data summary)
    const note = await generateCalibrationNote(
      sector,
      prevL1, prevL2, prevL3,
      l1, l2, l3,
      etfAcc, treasuryAcc, macroAcc,
      etfTotal
    );

    await sql`
      INSERT INTO model_weights
        (sector, l1_weight, l2_weight, l3_weight, sample_size, calibration_note)
      VALUES
        (${sector}, ${l1}, ${l2}, ${l3}, ${etfTotal}, ${note})
    `;
    console.log(`[calibrate] ${sector} → L1=${l1} L2=${l2} L3=${l3} (n=${etfTotal})`);
  }

  console.log("[accuracy] weight calibration complete");
}

// Called after each verification batch — recomputes signal_accuracy from verifications table
export async function refreshSignalAccuracy(): Promise<void> {
  if (!DB_AVAILABLE) return;
  const sectors = ["AI", "DePIN", "RWA", "DeFi", "L2", "L1", "GameFi", "Meme", "ALL"];
  const horizons = [7, 30];

  for (const horizon of horizons) {
    for (const sector of sectors) {
      const isAll = sector === "ALL";

      // combined
      const combinedRows = isAll
        ? await sql`
            SELECT COUNT(*) AS total, SUM(CASE WHEN v.thesis_verified THEN 1 ELSE 0 END) AS confirmed
            FROM predictions p JOIN verifications v ON v.prediction_id = p.id AND v.horizon_days = ${horizon}
          `
        : await sql`
            SELECT COUNT(*) AS total, SUM(CASE WHEN v.thesis_verified THEN 1 ELSE 0 END) AS confirmed
            FROM predictions p JOIN verifications v ON v.prediction_id = p.id AND v.horizon_days = ${horizon}
            WHERE p.sector = ${sector}
          `;
      await upsertAccuracy(sector, horizon, "combined", combinedRows.rows[0]);

      // etf layer
      const etfRows = isAll
        ? await sql`
            SELECT COUNT(*) AS total, SUM(CASE WHEN v.etf_confirmed THEN 1 ELSE 0 END) AS confirmed
            FROM predictions p JOIN verifications v ON v.prediction_id = p.id AND v.horizon_days = ${horizon}
          `
        : await sql`
            SELECT COUNT(*) AS total, SUM(CASE WHEN v.etf_confirmed THEN 1 ELSE 0 END) AS confirmed
            FROM predictions p JOIN verifications v ON v.prediction_id = p.id AND v.horizon_days = ${horizon}
            WHERE p.sector = ${sector}
          `;
      await upsertAccuracy(sector, horizon, "etf", etfRows.rows[0]);

      // treasury layer
      const treasuryRows = isAll
        ? await sql`
            SELECT COUNT(*) AS total, SUM(CASE WHEN v.treasury_confirmed THEN 1 ELSE 0 END) AS confirmed
            FROM predictions p JOIN verifications v ON v.prediction_id = p.id AND v.horizon_days = ${horizon}
          `
        : await sql`
            SELECT COUNT(*) AS total, SUM(CASE WHEN v.treasury_confirmed THEN 1 ELSE 0 END) AS confirmed
            FROM predictions p JOIN verifications v ON v.prediction_id = p.id AND v.horizon_days = ${horizon}
            WHERE p.sector = ${sector}
          `;
      await upsertAccuracy(sector, horizon, "treasury", treasuryRows.rows[0]);

      // macro layer
      const macroRows = isAll
        ? await sql`
            SELECT COUNT(*) AS total, SUM(CASE WHEN v.macro_confirmed THEN 1 ELSE 0 END) AS confirmed
            FROM predictions p JOIN verifications v ON v.prediction_id = p.id AND v.horizon_days = ${horizon}
          `
        : await sql`
            SELECT COUNT(*) AS total, SUM(CASE WHEN v.macro_confirmed THEN 1 ELSE 0 END) AS confirmed
            FROM predictions p JOIN verifications v ON v.prediction_id = p.id AND v.horizon_days = ${horizon}
            WHERE p.sector = ${sector}
          `;
      await upsertAccuracy(sector, horizon, "macro", macroRows.rows[0]);
    }
  }
  console.log("[accuracy] refreshed signal_accuracy");
}

async function upsertAccuracy(
  sector: string, horizon: number, layer: string,
  row: Record<string, unknown>
): Promise<void> {
  const total = parseInt(String(row.total ?? "0"));
  const confirmed = parseInt(String(row.confirmed ?? "0"));
  if (total === 0) return;
  const rate = confirmed / total;
  await sql`
    INSERT INTO signal_accuracy (sector, horizon_days, layer, total_calls, confirmed_calls, accuracy_rate, computed_at)
    VALUES (${sector}, ${horizon}, ${layer}, ${total}, ${confirmed}, ${rate}, NOW())
    ON CONFLICT (sector, horizon_days, layer) DO UPDATE SET
      total_calls     = EXCLUDED.total_calls,
      confirmed_calls = EXCLUDED.confirmed_calls,
      accuracy_rate   = EXCLUDED.accuracy_rate,
      computed_at     = EXCLUDED.computed_at
  `;
}
