import { createHash } from "crypto";
import { sql, DB_AVAILABLE } from "../db";
import type { ConvictionSignal } from "../types";
import { generateHypotheses, defaultHypotheses, type Hypothesis } from "./decomposer";

export type { Hypothesis };

export interface StoredPrediction {
  id: string;
  createdAt: string;
  sector: string;
  score: number;
  direction: string;
  layer1Score: number;
  layer2Score: number;
  layer3Score: number;
  etfNetFlow: number | null;
  btcPurchases: number | null;
  macroScoreRaw: number | null;
  rawSignalHash: string;
  hypotheses: Hypothesis[] | null;
  verifiedAt7d: string | null;
  thesisVerified7d: boolean | null;
  componentsConfirmed7d: number | null;
  verifiedAt30d: string | null;
  thesisVerified30d: boolean | null;
}

export interface PendingPrediction {
  id: string;
  sector: string;
  etfNetFlow: number | null;
  btcPurchases: number | null;
  macroScoreRaw: number | null;
  createdAt: string;
}

export async function insertPrediction(signal: ConvictionSignal): Promise<string | null> {
  if (!DB_AVAILABLE) return null;

  const hash = createHash("sha256")
    .update(JSON.stringify({
      sector: signal.sector,
      score: signal.overallScore,
      l1: signal.layer1Score,
      l2: signal.layer2Score,
      l3: signal.layer3Score,
      ts: new Date().toISOString(),
    }))
    .digest("hex");

  try {
    const { rows } = await sql`
      INSERT INTO predictions
        (sector, score, direction, layer1_score, layer2_score, layer3_score,
         etf_net_flow, btc_purchases, macro_score_raw, raw_signal_hash)
      VALUES (
        ${signal.sector},
        ${signal.overallScore},
        ${signal.direction},
        ${signal.layer1Score},
        ${signal.layer2Score},
        ${signal.layer3Score},
        ${signal.macro?.etfNetFlow ?? null},
        ${signal.institutional?.btcTreasuryPurchases ?? null},
        ${signal.macro?.macroScore ?? null},
        ${hash}
      )
      RETURNING id
    `;
    const id: string | undefined = rows[0]?.id;
    console.log("[ledger] inserted prediction", { id, sector: signal.sector, score: signal.overallScore });

    if (id) {
      // Generate 3 Haiku hypotheses non-blocking — falls back to deterministic defaults
      const hypoPromise = generateHypotheses(signal)
        .then(h => h ?? defaultHypotheses(signal));
      hypoPromise.then(hypotheses => {
        sql`UPDATE predictions SET hypotheses = ${JSON.stringify(hypotheses)}::jsonb WHERE id = ${id}`.catch(() => {});
      }).catch(() => {});
    }

    return id ?? null;
  } catch (err) {
    console.error("[ledger] insertPrediction failed:", err);
    return null;
  }
}

export async function insertPredictionAt(
  sector: string,
  score: number,
  direction: string,
  l1: number,
  l2: number,
  l3: number,
  etfNetFlow: number | null,
  btcPurchases: number | null,
  macroScoreRaw: number | null,
  createdAt: Date
): Promise<string | null> {
  if (!DB_AVAILABLE) return null;

  const hash = createHash("sha256")
    .update(JSON.stringify({ sector, score, l1, l2, l3, ts: createdAt.toISOString() }))
    .digest("hex");

  try {
    const { rows } = await sql`
      INSERT INTO predictions
        (sector, score, direction, layer1_score, layer2_score, layer3_score,
         etf_net_flow, btc_purchases, macro_score_raw, raw_signal_hash, created_at)
      VALUES (
        ${sector}, ${score}, ${direction}, ${l1}, ${l2}, ${l3},
        ${etfNetFlow}, ${btcPurchases}, ${macroScoreRaw}, ${hash}, ${createdAt.toISOString()}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("[ledger] insertPredictionAt failed:", err);
    return null;
  }
}

export async function insertVerification(
  predictionId: string,
  horizonDays: number,
  etfFlowThen: number,
  btcPurchasesThen: number,
  macroScoreThen: number,
  etfConfirmed: boolean,
  treasuryConfirmed: boolean,
  macroConfirmed: boolean,
  componentsConfirmed: number,
  thesisVerified: boolean
): Promise<void> {
  if (!DB_AVAILABLE) return;
  try {
    await sql`
      INSERT INTO verifications
        (prediction_id, horizon_days, etf_flow_then, btc_purchases_then, macro_score_then,
         etf_confirmed, treasury_confirmed, macro_confirmed, components_confirmed, thesis_verified)
      VALUES (
        ${predictionId}, ${horizonDays}, ${etfFlowThen}, ${btcPurchasesThen}, ${macroScoreThen},
        ${etfConfirmed}, ${treasuryConfirmed}, ${macroConfirmed}, ${componentsConfirmed}, ${thesisVerified}
      )
      ON CONFLICT (prediction_id, horizon_days) DO NOTHING
    `;
  } catch (err) {
    console.error("[ledger] insertVerification failed:", err);
  }
}

export async function getPendingVerifications(horizonDays: number): Promise<PendingPrediction[]> {
  if (!DB_AVAILABLE) return [];
  const cutoff = new Date(Date.now() - horizonDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { rows } = await sql`
      SELECT
        p.id,
        p.sector,
        p.etf_net_flow   AS "etfNetFlow",
        p.btc_purchases  AS "btcPurchases",
        p.macro_score_raw AS "macroScoreRaw",
        p.created_at     AS "createdAt"
      FROM predictions p
      WHERE p.created_at <= ${cutoff}
        AND NOT EXISTS (
          SELECT 1 FROM verifications v
          WHERE v.prediction_id = p.id AND v.horizon_days = ${horizonDays}
        )
      ORDER BY p.created_at ASC
      LIMIT 200
    `;
    return rows as PendingPrediction[];
  } catch (err) {
    console.error("[ledger] getPendingVerifications failed:", err);
    return [];
  }
}

export async function getRecentPredictions(limit = 60): Promise<StoredPrediction[]> {
  if (!DB_AVAILABLE) return [];
  try {
    const { rows } = await sql`
      SELECT
        p.id,
        p.created_at      AS "createdAt",
        p.sector,
        p.score,
        p.direction,
        p.layer1_score    AS "layer1Score",
        p.layer2_score    AS "layer2Score",
        p.layer3_score    AS "layer3Score",
        p.etf_net_flow    AS "etfNetFlow",
        p.btc_purchases   AS "btcPurchases",
        p.macro_score_raw AS "macroScoreRaw",
        p.raw_signal_hash AS "rawSignalHash",
        p.hypotheses,
        v7.verified_at         AS "verifiedAt7d",
        v7.thesis_verified     AS "thesisVerified7d",
        v7.components_confirmed AS "componentsConfirmed7d",
        v30.verified_at        AS "verifiedAt30d",
        v30.thesis_verified    AS "thesisVerified30d"
      FROM predictions p
      LEFT JOIN verifications v7  ON v7.prediction_id  = p.id AND v7.horizon_days  = 7
      LEFT JOIN verifications v30 ON v30.prediction_id = p.id AND v30.horizon_days = 30
      ORDER BY p.created_at DESC
      LIMIT ${limit}
    `;
    return rows as StoredPrediction[];
  } catch (err) {
    console.error("[ledger] getRecentPredictions failed:", err);
    return [];
  }
}

export async function getPredictionCount(): Promise<number> {
  if (!DB_AVAILABLE) return 0;
  try {
    const { rows } = await sql`SELECT COUNT(*) AS cnt FROM predictions`;
    return parseInt(rows[0].cnt ?? "0");
  } catch {
    return 0;
  }
}
