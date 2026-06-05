# ◈ Conviction Matrix

> **Stop trading news. Start trading conviction.**

**Live Demo:** [conviction-matrix.vercel.app](https://conviction-matrix.vercel.app/) · **Notion Submission:** [Docs](https://tundra-icon-9ac.notion.site/Conviction-Matrix-Wave-1-Submission-35a10f526b268026b72fc2071fe45154?pvs=73)

---

## Wave 1 — What We Built

Wave 1 delivered a fully working institutional signal convergence engine, scored across 8 major crypto sectors, with a Bloomberg-terminal dashboard and live SoDEX trade execution — end to end.

### The Core Engine

We built a 3-layer conviction scoring algorithm that runs in parallel across AI, DePIN, RWA, DeFi, L2, L1, GameFi, and Meme sectors every 5 minutes. Each sector gets a composite score from 0–100 based on where institutional money is actually moving — not what the news is saying.

```
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
