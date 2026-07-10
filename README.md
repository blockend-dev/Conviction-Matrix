# ◈ Conviction Matrix

> **Stop trading news. Start trading conviction.**

**Live Demo:** [conviction-matrix.vercel.app](https://conviction-matrix.vercel.app/) · **Wave 1 Submission:** [Notion Doc](https://tundra-icon-9ac.notion.site/Conviction-Matrix-Wave-1-Submission-35a10f526b268026b72fc2071fe45154?pvs=73)

---

## Wave 2 — What We Built

Wave 2 hardened the live data pipeline: the SoSoValue API integration was fully debugged against the real production API, all conviction scores now compute correctly from live data, and the backtesting panel was shipped as a deterministic synthetic simulation.

### API Integration — Production-Grade

Wave 1 shipped with a working mock fallback. Wave 2 made the live API path actually work.

**News feed (was broken, now live):** The SoSoValue news endpoint returns a paginated object `{page, page_size, total, list: [...]}` — not a flat array. The client was rewritten to extract `.list`, strip HTML from the `content` field for clean summaries, parse millisecond Unix timestamps safely, and map integer category codes to human-readable labels. Auth header corrected from `Authorization: Bearer` to `x-soso-api-key`.

**NaN conviction scores (root cause fixed):** SoSoValue's Java/Kotlin backend serializes `BigDecimal` and `Long` fields as JSON strings (e.g. `"318000000"` instead of `318000000`). The `??` operator passes strings through silently, so arithmetic like `0 + "318000000"` produced `NaN` across every sector score. Fixed with a single `n()` coercion helper applied to every numeric field in every mapper:

```typescript
function n(v: unknown): number { return Number(v) || 0; }
```

**Timeout / sequential call fix:** The institutional signal layer was fetching 4 stock snapshots sequentially inside a for-loop, with an 8-second timeout on each. That stacked to 32 seconds worst-case — beyond the API route limit. Refactored to `Promise.all`, capping worst-case at 8 seconds regardless of how many tickers are queried.

**8-second AbortController timeout:** Every `fetch()` call now has a hard 8-second abort with a safe fallback to mock data, replacing the OS TCP timeout (~30s) that was silently hanging requests.

**Fundraising layer:** The SoSoValue `/fundraising/projects` list endpoint only returns `project_id` + `project_name` — no sector, amount, or date. Layer 1 uses curated mock data until a richer endpoint or alternative source is available. This is documented in the engine rather than papered over.

### Backtesting Panel

The backtesting page shipped as a deterministic synthetic simulation using a seeded LCG (linear congruential generator). Given a date range and sector, it produces fully consistent fictional returns that look and feel like real backtested data without requiring a historical score database. True backtesting (replaying historical conviction scores vs. actual price) requires a database that stores scores over time — that's Wave 3.

### Build (Wave 2)

```text
✓ next build: compiled successfully
✓ TypeScript: zero errors
✓ All 8 sectors: real numeric conviction scores (no NaN)
✓ Live news feed: real SoSoValue articles with HTML stripped
✓ Backtesting panel: deterministic synthetic simulation
```

---

## Wave 1 — What We Built

Wave 1 delivered a fully working institutional signal convergence engine, scored across 8 major crypto sectors, with a Bloomberg-terminal dashboard and live SoDEX trade execution — end to end.

### The Core Engine

We built a 3-layer conviction scoring algorithm that runs in parallel across AI, DePIN, RWA, DeFi, L2, L1, GameFi, and Meme sectors every 5 minutes. Each sector gets a composite score from 0–100 based on where institutional money is actually moving — not what the news is saying.

```text
Conviction Score = L1 × 30% + L2 × 35% + L3 × 35%
```

- **Layer 1 — Fundraising (30%):** Pulls from `/fundraising/projects` and counts VC capital deployed per sector over the past 30 days. $50M+ raised quietly into a sector means a narrative is forming before anyone publishes about it.
- **Layer 2 — Institutional (35%):** Combines BTC treasury company purchase velocity (`/btc-treasuries` + purchase history) with crypto-adjacent stock momentum (MSTR, COIN, MARA, RIOT). Real capital at risk from public companies with fiduciary duties — the highest-signal input in the engine.
- **Layer 3 — Macro/ETF (35%):** 7-day rolling ETF net flow from `/etfs/summary-history` plus historical crypto market reaction per macro event type from `/macro/events/{event}/history`. Institutions don't size up until the macro environment supports it.

A score above 75 is `STRONG_BUY`. A single strong layer maxes out at ~35 points — all three must converge to trigger a signal.

### SoSoValue API — 9 Modules Integrated

| Module | Endpoint | Layer |
|--------|----------|-------|
| Fundraising | `/fundraising/projects` | L1 |
| BTC Treasuries | `/btc-treasuries` | L2 |
| BTC Purchase History | `/btc-treasuries/{ticker}/purchase-history` | L2 |
| Crypto Stocks | `/crypto-stocks/{ticker}/market-snapshot` | L2 |
| ETF Summary History | `/etfs/summary-history` | L3 |
| Macro Events | `/macro/events` | L3 |
| Macro Event History | `/macro/events/{event}/history` | L3 |
| News Feed | `/news` | Narrative |
| Sector Spotlight | `/currencies/sector-spotlight` | Context |

Every module has a typed client and a realistic mock fallback — the demo works offline without any API key.

### SoDEX Integration

We implemented the full EIP-712 signing spec from scratch: `ExchangeAction` typed data with `payloadHash` (keccak256 of compact JSON in Go struct field order) and millisecond `nonce`, `0x01`-prefixed typed signature, and `X-API-Key` / `X-API-Sign` / `X-API-Nonce` headers. The signer's own EVM wallet address serves as the API key — no separate registration needed on testnet.

Read endpoints used: `/markets/symbols`, `/markets/tickers`, `/markets/{symbol}/orderbook`, `/markets/{symbol}/klines`  
Write endpoint: `POST /trade/orders/batch` (proxied server-side — API credentials never reach the browser)

### Claude Haiku Narrative Layer

For the top 4 conviction signals per refresh cycle, we send the real layer scores, fundraising capital figures, and ETF flow numbers to `claude-haiku-4-5` and get back a 2-sentence plain-English explanation of why the signal is forming. Fast enough to run continuously, grounded in the actual data, not generic sentiment.

### Dashboard

Bloomberg-dark terminal theme. The main view shows all 8 sectors as score cards — each card shows the composite score, direction badge (`STRONG_BUY` / `BUY` / `NEUTRAL` / `SELL`), and three animated layer bars. Click any sector to open a full 3-layer drill-down with raw data breakdown and a Claude narrative. From the drill-down, one click opens the execution modal: market or limit order, quantity input, EIP-712 signing via MetaMask, and live submission to SoDEX testnet. A scrolling ticker strip shows live SoDEX prices at the top. A live news panel pulls from SoSoValue and updates every 60 seconds.

### Build

```
✓ next build: compiled successfully
✓ TypeScript: zero errors
✓ 4 API routes: /api/conviction, /api/execute, /api/markets, /api/news
✓ 7 pages generated
✓ 13 git commits — full development history from scaffold to working build
```

---

## The Problem

Every other tool in crypto does the same thing: read news → generate a trading signal. By the time a retail trader sees a signal based on news, institutional players have already positioned.

Smart money moves in a predictable sequence:
1. VCs fund a narrative first (funding rounds close quietly)
2. Corporate treasuries and public companies accumulate exposure
3. ETF flows and macro events confirm the trend
4. **Then** the news cycle catches up — and retail buys the top

Conviction Matrix intercepts this at Steps 1–2, before Step 4.

---

## Target Users

| User | Pain Point | How We Help |
|------|-----------|-------------|
| **Retail crypto traders** | Trading news that is already priced in | See institutional conviction forming before price moves |
| **DeFi power users** | No structured framework for sector rotation | 3-layer score per sector, updated every 5 min |
| **Solo fund managers** | Can't afford Bloomberg / institutional data tools | Institutional-grade intelligence in a single dashboard |

---

## Conviction Scoring Algorithm

### Layer 1 — Fundraising Signal (0–100)
```
amount_score = min(50, (total_raised_30d / $50M) × 50)
count_score  = min(50, round_count × 10)
L1 = amount_score + count_score
```

### Layer 2 — Institutional Signal (0–100)
```
btc_score   = min(50, (btc_purchased_30d / 5000) × 50)
stock_score = min(50, max(0, avg_stock_change% × 5))
L2 = btc_score + stock_score
```

### Layer 3 — Macro / ETF Signal (0–100)
```
etf_score   = min(100, max(0, 50 + (net_flow_7d / $100M) × 10))
macro_score = min(100, max(0, 50 + avg_historical_impact × 3))
L3 = (etf_score + macro_score) / 2
```

### Signal Direction
| Score | Direction |
|-------|-----------|
| ≥ 75 | `STRONG_BUY` |
| 60–74 | `BUY` |
| 40–59 | `NEUTRAL` |
| 25–39 | `SELL` |
| < 25 | `STRONG_SELL` |

---

## Quick Start

```bash
git clone <repo>
cd conviction-matrix
npm install

# Optional — app runs on mock data without keys
cp .env.example .env.local

npm run dev
# → http://localhost:3000
```

### Environment Variables

| Variable | Source |
|----------|--------|
| `SOSOVALUE_API_KEY` | [SoSoValue API Docs](https://sosovalue-1.gitbook.io/sosovalue-api-doc) |
| `SODEX_API_KEY` | [SoDEX Docs](https://sodex.com/documentation/api/api) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main dashboard
│   ├── layout.tsx                  # Root layout + scanline effect
│   └── api/
│       ├── conviction/route.ts     # Scoring engine endpoint
│       ├── execute/route.ts        # SoDEX order proxy
│       ├── markets/route.ts        # SoDEX market data
│       └── news/route.ts           # SoSoValue news feed
├── components/
│   ├── ConvictionCell.tsx          # Sector score card with 3 layer bars
│   ├── SignalDetail.tsx            # Full drill-down panel
│   ├── ExecutionModal.tsx          # SoDEX trade modal (EIP-712)
│   ├── NewsFeed.tsx                # Live intelligence feed
│   ├── MarketTicker.tsx            # Scrolling SoDEX price strip
│   ├── ScoreBar.tsx                # Animated score bar component
│   └── DirectionBadge.tsx          # BUY/SELL/NEUTRAL badge
└── lib/
    ├── types.ts                    # Shared TypeScript types
    ├── conviction/
    │   ├── engine.ts               # 3-layer scoring algorithm
    │   └── sectorMap.ts            # Sector → token mapping
    ├── sosovalue/
    │   ├── client.ts               # SoSoValue API client (9 modules)
    │   └── mock.ts                 # Realistic mock data for demo
    ├── sodex/
    │   ├── client.ts               # SoDEX read client
    │   └── signer.ts               # EIP-712 signing + order submission
    └── claude.ts                   # Claude narrative generation
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS (Bloomberg-dark terminal theme) |
| Data | SoSoValue API (9 modules) |
| Execution | SoDEX API + EIP-712 signing (ethers v6) |
| AI | Claude Haiku (Anthropic SDK) |
| Charts | Recharts |
| Deploy | Vercel |

---

## Wave 3 — Conviction Verification Engine

Wave 3 turns Conviction Matrix from a signal dashboard into a **verifiable track record**. Every sector conviction call is now a structured prediction logged to a Postgres ledger and verified against live SoSoValue capital flow data at T+7 and T+30. The engine is fully autonomous: Vercel Cron re-fetches data every 4 hours, evaluates pending predictions, and updates accuracy stats.

### What Was Delivered

**Conviction Verification Protocol**
Every signal is a prediction with 3 machine-testable hypotheses:
1. ETF net flow remains ≥50% of original magnitude in the same direction at T+7
2. BTC treasury purchases > 0 (or = 0 if original signal had none) at T+7
3. Macro score stays within ±15 points of original at T+7

Thesis **confirmed** = ≥2/3 conditions met. Results logged in the `verifications` table for both T+7 and T+30 horizons.

**Thesis Decomposer AI**
Before storing each prediction, Claude Haiku generates 3 natural-language, sector-specific hypotheses — one per verification dimension. These are stored alongside the prediction and shown on the Track Record page. Falls back to deterministic defaults when `ANTHROPIC_API_KEY` is not set — the ledger always has human-readable hypotheses.

**Wilson Score Confidence Labels**
After verification data accumulates, every sector's accuracy is expressed as a Wilson 95% confidence interval lower bound — a conservative estimate that accounts for sample size. Labels: `HIGH` (>70%), `MODERATE` (>55%), `LOW` (≤55%), `INSUFFICIENT` (<10 samples). Shown on conviction cards, signal drill-down, and the Verify dashboard.

**Weight Calibration Engine**
Once a sector accumulates 30+ verified predictions, the engine derives per-sector L1/L2/L3 weights from empirical layer accuracy rates. Formula: normalize [macro_acc, treasury_acc, etf_acc] → blend 60% empirical / 40% defaults (dampens overfitting). Results written to `model_weights` table and exposed via `/api/weights/current`. Runs every Monday via Vercel Cron.

**90-Day Historical Seed**
On first setup, `/api/setup` backfills 90 days of predictions using real SoSoValue ETF history data (newest-first, sector-specific macro sensitivity multipliers). T+7 and T+30 verifications are computed from the historical ETF arrays, giving the Wilson estimator real data from day one.

**Track Record Page** (`/backtest`)
Replaced the synthetic LCG simulation with a real-data track record powered by the prediction ledger. Shows per-sector conviction score plotted alongside rolling verification rate, a layer accuracy breakdown table (combined / ETF / treasury / macro), and a scrollable verified prediction log with sector, score, direction, and T+7/T+30 confirmation status.

**Verify Dashboard** (`/verify`)
Three-tab dashboard: Accuracy Stats (Wilson bounds for all 8 sectors × 7d/30d × 4 layers), Prediction Ledger (last 60 predictions with hash), and Weight History (calibration audit trail with sample sizes).

### New Routes Delivered

| Route | Purpose | Schedule |
|-------|---------|----------|
| `GET /api/setup?secret=` | One-time DB migration + 90-day seed | Manual |
| `GET /api/verify/run` | Re-verify pending predictions (T+7 + T+30) | Every 4h |
| `GET /api/verify/summary` | Dashboard data (accuracy + recent predictions) | On-demand |
| `GET /api/weights/current` | Current L1/L2/L3 weights + calibration history | On-demand |
| `GET /api/calibrate` | Derive per-sector weights from verification rates | Every Monday 8am |

### New Files

```
src/
├── lib/
│   ├── db.ts                          # DB client + migrate() (4 tables)
│   └── ledger/
│       ├── store.ts                   # Prediction CRUD + signal hash
│       ├── verify.ts                  # Thesis evaluation engine
│       ├── accuracy.ts                # Wilson confidence + calibrateWeights()
│       ├── decomposer.ts              # Haiku → 3 verifiable hypotheses
│       └── seed.ts                    # 90-day historical backfill
├── app/
│   ├── verify/page.tsx                # Accuracy + ledger + weights dashboard
│   ├── backtest/page.tsx              # Real track record (replaces LCG sim)
│   └── api/
│       ├── setup/route.ts             # Migration + seed endpoint
│       ├── verify/run/route.ts        # 4-hour verification cron
│       ├── verify/summary/route.ts    # Dashboard data endpoint
│       ├── calibrate/route.ts         # Weekly weight calibration cron
│       └── weights/current/route.ts   # Public weights API
vercel.json                            # Cron: verify every 4h + calibrate weekly
```

### Schema

```sql
predictions        -- every signal logged with sector, scores, ETF/BTC/macro raw values + hypotheses JSONB
verifications      -- T+7 and T+30 results per prediction (etf/treasury/macro confirmed + thesis_verified)
signal_accuracy    -- aggregated per sector × horizon × layer (etf/treasury/macro/combined)
model_weights      -- calibration history with L1/L2/L3 weights and audit notes
```

### Enabling the Ledger

```bash
# 1. Add to .env.local
POSTGRES_URL=<vercel_postgres_or_neon_connection_string>
CRON_SECRET=<any_random_secret>

# 2. Run migration + 90-day seed once
curl "https://conviction-matrix.vercel.app/api/setup?secret=YOUR_CRON_SECRET"

# 3. Vercel Cron handles the rest — every 4h for verification, every Monday for calibration
```

### Build (Wave 3)

```text
✓ next build: compiled successfully (95s)
✓ TypeScript: zero errors
✓ 12 routes: 5 new API routes + /verify + /backtest (real data)
✓ Vercel Cron: 2 jobs configured (verify every 4h, calibrate every Monday)
✓ Thesis Decomposer: Haiku hypotheses stored per prediction, falls back gracefully
✓ Wilson confidence labels on conviction cards and signal drill-down
✓ Track record: real verification data, no synthetic simulation
```

---
