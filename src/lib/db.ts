import { sql } from "@vercel/postgres";

export const DB_AVAILABLE = !!process.env.POSTGRES_URL;
export { sql };

export async function migrate(): Promise<void> {
  if (!DB_AVAILABLE) {
    console.warn("[db] POSTGRES_URL not set — ledger disabled. Add POSTGRES_URL to .env.local to enable tracking.");
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS predictions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sector          TEXT NOT NULL,
      score           INT NOT NULL,
      direction       TEXT NOT NULL,
      layer1_score    INT NOT NULL,
      layer2_score    INT NOT NULL,
      layer3_score    INT NOT NULL,
      etf_net_flow    NUMERIC,
      btc_purchases   NUMERIC,
      macro_score_raw INT,
      raw_signal_hash TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS verifications (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prediction_id        UUID REFERENCES predictions(id),
      verified_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      horizon_days         INT NOT NULL,
      etf_flow_then        NUMERIC,
      btc_purchases_then   NUMERIC,
      macro_score_then     INT,
      etf_confirmed        BOOLEAN,
      treasury_confirmed   BOOLEAN,
      macro_confirmed      BOOLEAN,
      components_confirmed INT,
      thesis_verified      BOOLEAN,
      UNIQUE(prediction_id, horizon_days)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS signal_accuracy (
      sector          TEXT NOT NULL,
      horizon_days    INT NOT NULL,
      layer           TEXT NOT NULL,
      total_calls     INT NOT NULL DEFAULT 0,
      confirmed_calls INT NOT NULL DEFAULT 0,
      accuracy_rate   NUMERIC(5,4),
      computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (sector, horizon_days, layer)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS model_weights (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      effective_from   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sector           TEXT NOT NULL DEFAULT 'ALL',
      l1_weight        NUMERIC(5,4) NOT NULL DEFAULT 0.30,
      l2_weight        NUMERIC(5,4) NOT NULL DEFAULT 0.35,
      l3_weight        NUMERIC(5,4) NOT NULL DEFAULT 0.35,
      sample_size      INT NOT NULL DEFAULT 0,
      calibration_note TEXT
    )
  `;

  // Idempotent column additions for schema upgrades (safe on existing tables)
  await sql`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS hypotheses JSONB`;

  await sql`CREATE INDEX IF NOT EXISTS idx_pred_sector ON predictions(sector, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pred_time ON predictions(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_verif_pred ON verifications(prediction_id)`;

  console.log("[db] migration complete");
}
