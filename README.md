# ◈ Conviction Matrix

> **Stop trading news. Start trading conviction.**

Conviction Matrix is an institutional signal convergence engine built on SoSoValue + SoDEX. It tracks where smart money is moving *before* it becomes a news story — and executes when all three institutional layers align.

**Live Demo:** [localhost:3000](http://localhost:3000) · **GitHub:** [this repo]

---

## The Problem

Every other tool in crypto does the same thing: read news → generate a trading signal. By the time a retail trader sees a signal based on news, institutional players have already positioned.

Smart money moves in a predictable sequence:
1. VCs fund a narrative first (fundraising rounds close quietly)
2. Corporate treasuries and public companies accumulate exposure
3. ETF flows and macro events confirm the trend
4. **Then** the news cycle catches up — and retail buys the top

Conviction Matrix intercepts this at Step 1-2, before Step 4.

---

## Target Users

| User | Pain Point | How We Help |
|------|-----------|-------------|
| **Retail crypto traders** | Trading news that is already priced in | See institutional conviction forming before price moves |
| **DeFi power users** | No structured framework for sector rotation | 3-layer score per sector, updated every 5 min |
| **Solo fund managers** | Can't afford Bloomberg / institutional data tools | Institutional-grade intelligence in a single dashboard |
| **Buildathon judges** | Want to see the "one-person business empire" vision | One person can now run a conviction-driven fund |

---

## Use Case Definition

### Primary Use Case — Sector Conviction Scanning
A trader opens Conviction Matrix and sees the 8 major crypto sectors ranked by a composite institutional conviction score (0–100). They click AI (score: 82) and see: $43M raised by AI projects in the last 30 days, crypto AI stocks up 5.8% avg, ETF flows strongly positive. The narrative panel (Claude Haiku) explains the convergence in plain English. They execute a position on SoDEX directly from the dashboard.

### Secondary Use Case — Pre-Trade Intelligence
Before executing any trade, a user checks whether the sector has institutional backing. If Layer 1 + Layer 2 are high but Layer 3 is lagging, they know the macro catalyst hasn't fired yet — and can wait for the right entry.

### Tertiary Use Case — Narrative Research
Fund managers and researchers use the drill-down view to understand WHY a sector is scoring high: which VCs are funding it, which corporate treasury companies have exposure, what ETF flows look like, and what historical macro events have done to this sector.

---

## API Usage Plan

### SoSoValue API — 9 Modules

| Module | Endpoint | Layer | Usage |
|--------|----------|-------|-------|
| Fundraising | `/fundraising/projects` | L1 | Count rounds + total capital per sector in 30 days |
| BTC Treasuries | `/btc-treasuries` | L2 | Track corporate BTC accumulation as institutional proxy |
| BTC Purchase History | `/btc-treasuries/{ticker}/purchase-history` | L2 | Recent purchase velocity scoring |
| Crypto Stocks | `/crypto-stocks/{ticker}/market-snapshot` | L2 | Public company momentum across MSTR, COIN, MARA, RIOT |
| ETF Summary History | `/etfs/summary-history` | L3 | 7-day rolling net ETF flow → institutional demand signal |
| Macro Events | `/macro/events` | L3 | Upcoming catalyst calendar |
| Macro Event History | `/macro/events/{event}/history` | L3 | Historical crypto market reaction per event type |
| News Feed | `/news` | Confirmation | Narrative confirmation + live intelligence feed |
| Sector Spotlight | `/currencies/sector-spotlight` | Context | Sector performance context for score calibration |

### SoDEX API

| Type | Endpoint | Usage |
|------|----------|-------|
| Read | `GET /markets/symbols` | Trading pair rules (tick/step size, precision) |
| Read | `GET /markets/tickers` | 24hr price stats — live ticker strip |
| Read | `GET /markets/{symbol}/orderbook` | Order book depth |
| Read | `GET /markets/{symbol}/klines` | OHLCV candlestick data |
| Write | `POST /trade/orders/batch` | EIP-712 signed batch order submission |

**Auth:** `X-API-Key` (signer EVM address) · `X-API-Sign` (0x01-prefixed EIP-712 sig) · `X-API-Nonce` (Unix ms timestamp)

**Testnet base URL:** `https://testnet-gw.sodex.dev/api/v1/spot` · chainId `138565`

### Claude API (Anthropic)

- Model: `claude-haiku-4-5` (cost-efficient, fast)
- Usage: Generate 2-sentence narrative for top 4 conviction signals
- Prompt includes: layer scores, fundraising data, institutional data, macro data
- Output: Plain-English explanation of WHY the signal is forming

---

## Conviction Scoring Algorithm

```
Conviction Score = L1 × 0.30 + L2 × 0.35 + L3 × 0.35
```

### Layer 1 — Fundraising Signal (0–100)
```
amount_score = min(50, (total_raised_30d / $50M) × 50)
count_score  = min(50, round_count × 10)
L1 = amount_score + count_score
```
- $50M+ raised in a sector = 50 pts
- 5+ rounds in 30 days = 50 pts

### Layer 2 — Institutional Signal (0–100)
```
btc_score   = min(50, (btc_purchased_30d / 5000) × 50)
stock_score = min(50, max(0, avg_stock_change% × 5))
L2 = btc_score + stock_score
```
- 5,000+ BTC purchased by treasury companies = 50 pts
- 10%+ avg crypto stock gain = 50 pts

### Layer 3 — Macro / ETF Signal (0–100)
```
etf_score   = min(100, max(0, 50 + (net_flow_7d / $100M) × 10))
macro_score = min(100, max(0, 50 + avg_historical_impact × 3))
L3 = (etf_score + macro_score) / 2
```
- $1B+ 7-day ETF inflow = ~100 pts
- Positive historical macro impact = above 50

### Signal Direction
| Score | Direction |
|-------|-----------|
| ≥ 75 | `STRONG_BUY` |
| 60–74 | `BUY` |
| 40–59 | `NEUTRAL` |
| 25–39 | `SELL` |
| < 25 | `STRONG_SELL` |

---

## Workflow Design

```
┌─────────────────────────────────────────────────────────────┐
│                    CONVICTION MATRIX ENGINE                  │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │   LAYER 1    │  │   LAYER 2    │  │   LAYER 3    │
   │ Fundraising  │  │ Institutional│  │ Macro / ETF  │
   │              │  │              │  │              │
   │ SoSoValue    │  │ BTC Treasury │  │ ETF Flows    │
   │ /fundraising │  │ Crypto Stocks│  │ Macro Events │
   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            ▼
               ┌────────────────────────┐
               │  CONVICTION SCORING    │
               │  L1×30% + L2×35%       │
               │        + L3×35%        │
               └────────────┬───────────┘
                            │
               ┌────────────┼────────────┐
               ▼            ▼            ▼
        Score ≥ 60    Score 40–59   Score < 40
        BUY Signal     NEUTRAL       SELL Signal
               │                         │
               ▼                         ▼
    ┌─────────────────┐       ┌─────────────────────┐
    │  CLAUDE HAIKU   │       │  ALERT / MONITOR     │
    │  Narrative AI   │       │  No execution        │
    └────────┬────────┘       └─────────────────────┘
             │
             ▼
    ┌─────────────────┐
    │  DASHBOARD UI   │
    │  Signal Detail  │
    │  Drill-down     │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │  EXECUTION      │
    │  EIP-712 Sign   │
    │  → SoDEX Order  │
    │  Risk: SL + TP  │
    └─────────────────┘
```

### Data Refresh Schedule
- Fundraising signals: every 5 minutes
- Institutional signals: every 5 minutes
- Macro/ETF signals: every 5 minutes
- News feed: every 60 seconds
- Market ticker (SoDEX prices): every 30 seconds

---

## Early Prototype — Wave 1 Deliverables

### What Is Built and Working

**1. Full conviction scoring engine** ([src/lib/conviction/engine.ts](src/lib/conviction/engine.ts))
- 3-layer parallel computation
- 8 sectors scored simultaneously
- Works with live SoSoValue API or mock data fallback

**2. SoSoValue API client** ([src/lib/sosovalue/client.ts](src/lib/sosovalue/client.ts))
- All 9 modules integrated
- Typed responses for every endpoint
- Realistic mock data for offline demo

**3. SoDEX integration** ([src/lib/sodex/](src/lib/sodex/))
- Public read endpoints: markets, tickers, orderbook, klines
- EIP-712 order signing via MetaMask (`eth_signTypedData_v4`)
- Server-side order submission proxy (API key never reaches browser)

**4. Claude AI narrative layer** ([src/lib/claude.ts](src/lib/claude.ts))
- Haiku model for cost-efficiency
- Generates 2-sentence sector narrative from real signal data
- Top 4 signals by conviction score get narratives on each refresh

**5. Dashboard UI** ([src/app/page.tsx](src/app/page.tsx))
- 8-sector conviction matrix grid
- Click any sector → 3-layer drill-down with data breakdown
- One-click trade execution modal with stop-loss + take-profit inputs
- Live SoDEX market ticker strip
- SoSoValue news intelligence feed
- Active BUY signals panel with Claude narratives

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS (Bloomberg-dark terminal theme) |
| Data | SoSoValue API (9 modules) |
| Execution | SoDEX API + EIP-712 signing (ethers v6) |
| AI | Claude Haiku (Anthropic SDK) |
| Charts | Recharts |
| Deploy | Vercel (Wave 2) |

### Build Status
```
✓ Compiled successfully
✓ Type check passing
✓ 4 API routes (conviction, execute, markets, news)
✓ 7 pages generated
```

---

## Quick Start

```bash
# Clone and install
git clone <repo>
cd conviction-matrix
npm install

# Configure API keys (optional — works with mock data without keys)
cp .env.example .env.local
# Edit .env.local with your keys

# Run
npm run dev
# → http://localhost:3000
```

### Environment Variables

| Variable | Required | Source |
|----------|----------|--------|
| `SOSOVALUE_API_KEY` | For live data | [SoSoValue API Docs](https://sosovalue-1.gitbook.io/sosovalue-api-doc) |
| `SODEX_API_KEY` | For order submission | [SoDEX Docs](https://sodex.com/documentation/api/api) |
| `ANTHROPIC_API_KEY` | For AI narratives | [console.anthropic.com](https://console.anthropic.com) |

The app runs fully on mock data without any API keys — ideal for demo.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main dashboard
│   ├── layout.tsx                  # Root layout + scanline effect
│   └── api/
│       ├── conviction/route.ts     # Scoring engine endpoint (dynamic)
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


## Wave 2 Roadmap

- [ ] Backtesting engine: historical conviction score vs. actual price returns per sector
- [ ] Wallet Connect integration (RainbowKit) for seamless execution
- [ ] Conviction alerts: Telegram / push notification when score crosses threshold
- [ ] SoDEX testnet live execution with real wallet
- [ ] Vercel production deployment

## Wave 3 Roadmap

- [ ] Historical conviction score chart overlaid with price
- [ ] Multi-token execution: auto-build a sector basket on SoDEX
- [ ] Strategy memory: track past signal accuracy, tune weights dynamically
- [ ] Public signal sharing: shareable conviction report URL

---
