# Conviction Matrix — Wave 1 Submission

**Tagline:** Stop trading news. Start trading conviction.

**Category:** Signal-to-Execution Agent · Market Infrastructure · AI

**Status:** ✅ Early Prototype Complete

---

## 1. Idea Direction

Most crypto tools solve the wrong problem. They read news, score sentiment, and fire a trade signal. But by the time news is published, institutional players have already positioned. Retail traders are always reacting to yesterday's moves.

Conviction Matrix flips this model. Instead of watching news, it watches **institutional behavior** — the three layers that precede any major price move:

1. **Venture capital** is the earliest signal. When $30–50M floods into a sector in 30 days, a narrative is forming before anyone talks about it publicly.
2. **Corporate treasuries and public companies** come next. BTC treasury companies buying + crypto stocks rallying = smart money with skin in the game.
3. **ETF flows and macro events** confirm the trend. Institutions don't bet big until the macro environment supports it.

When all three layers converge on the same sector, that's the alpha window. Conviction Matrix detects this convergence and scores it 0–100. Above 75 = STRONG BUY. Below 40 = stay away.

**The core insight:** Smart money moves in a predictable sequence. We track the sequence, not the outcome.

---

## 2. Target Users

### Primary — Retail Crypto Traders
**Problem:** They trade news that is already priced in and have no visibility into what institutional players are doing.

**How we help:** Conviction Matrix gives them the same three-layer view that a hedge fund analyst would build manually — automated, real-time, and zero Bloomberg subscription required.

### Secondary — DeFi Power Users / Solo Fund Managers
**Problem:** Managing a crypto portfolio without a structured framework for sector rotation is guesswork.

**How we help:** A live conviction score per sector, updated every 5 minutes, tells them exactly where institutional confidence is building and where it's collapsing.

### Tertiary — Buildathon Judges
**Problem:** They want to see SoSoValue's "one-person business empire" vision realised.

**How we help:** Conviction Matrix is the literal embodiment — a single person can now run a conviction-driven crypto fund using institutional data that previously required a full research team.

---

## 3. Use Case Definition

### Use Case 1 — Sector Conviction Scan (Primary)
**Who:** Retail trader deciding where to allocate this week.

**Flow:**
1. Open Conviction Matrix → see 8 sectors ranked by score
2. AI sector is 82/100 (STRONG BUY). Click it.
3. Drill-down shows: $43M raised in AI projects (L1), MSTR + COIN stocks up 4.2% avg (L2), $318M ETF inflow this week (L3)
4. Claude Haiku explains the convergence in two sentences
5. Click "Execute on SoDEX" → position opened with stop-loss and take-profit

**Outcome:** User enters a position with full institutional justification, not gut feel.

### Use Case 2 — Pre-Trade Validation (Secondary)
**Who:** Trader about to buy an AI token based on Twitter noise.

**Flow:**
1. Check Conviction Matrix AI score → 61 (BUY, not STRONG BUY)
2. L1 high (lots of VC funding), L2 moderate, L3 low (ETF flows flat)
3. Decision: macro confirmation hasn't arrived yet → wait for L3 to confirm before sizing up

**Outcome:** User avoids overexposure before the macro catalyst fires.

### Use Case 3 — Narrative Research (Tertiary)
**Who:** Solo fund manager writing a weekly report.

**Flow:**
1. Pull up RWA sector → score 68 (BUY)
2. See which specific projects got funded, which companies have exposure, what ETF flows look like
3. Claude narrative: "RWA conviction is building on the back of Ondo Finance's $46M raise and consistent BlackRock ETF inflows — institutional appetite for tokenized yield is structurally growing."
4. Copy insight into weekly report

**Outcome:** Research-grade sector analysis in 30 seconds.

---

## 4. API Usage Plan

### SoSoValue API Integration

| Layer | Module | Endpoint | What We Extract |
|-------|--------|----------|----------------|
| **L1 — Fundraising** | Fundraising | `/fundraising/projects` | Round count + total capital per sector per 30 days |
| **L2 — Institutional** | BTC Treasuries | `/btc-treasuries` | Active treasury companies and BTC held |
| **L2 — Institutional** | BTC Purchase History | `/btc-treasuries/{ticker}/purchase-history` | Recent purchase velocity |
| **L2 — Institutional** | Crypto Stocks | `/crypto-stocks/{ticker}/market-snapshot` | MSTR, COIN, MARA, RIOT price momentum |
| **L3 — Macro/ETF** | ETF Summary History | `/etfs/summary-history` | 7-day rolling net flow (BTC + ETH combined) |
| **L3 — Macro/ETF** | Macro Events | `/macro/events` | Upcoming catalyst calendar (FOMC, CPI, GDP) |
| **L3 — Macro/ETF** | Macro Event History | `/macro/events/{event}/history` | Historical crypto reaction to each event type |
| **Confirmation** | News Feed | `/news` | Live narrative confirmation + intelligence feed |
| **Context** | Sector Spotlight | `/currencies/sector-spotlight` | Sector price context for score calibration |

**Total: 9 SoSoValue modules actively integrated.**

### SoDEX API Integration

| Type | Endpoint | Usage |
|------|----------|-------|
| Read | `GET /v1/markets` | Available trading pairs for execution |
| Read | `GET /v1/markets/{market}/ticker` | Live prices in real-time ticker strip |
| Write | `POST /v1/orders` | EIP-712 signed order submission from conviction signals |

### Claude API (Anthropic)

| Property | Value |
|----------|-------|
| Model | claude-haiku-4-5-20251001 |
| When | After conviction scores are computed, for top 4 signals |
| Input | Layer scores, fundraising detail, institutional data, ETF flows |
| Output | 2-sentence plain-English sector narrative |
| Why Haiku | Cost-efficient for high-frequency generation; fast for real-time UX |

---

## 5. Workflow Design

```
DATA INGESTION (every 5 min)
        │
        ├── SoSoValue /fundraising/projects ─────────────┐
        ├── SoSoValue /btc-treasuries ───────────────────┤
        ├── SoSoValue /crypto-stocks/*/market-snapshot ──┤
        ├── SoSoValue /etfs/summary-history ─────────────┤
        └── SoSoValue /macro/events/*/history ────────────┘
                                │
                                ▼
              CONVICTION SCORING ENGINE
              (per sector, parallel execution)
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
    L1 Score (0-100)      L2 Score (0-100)       L3 Score (0-100)
    Fundraising           Institutional          Macro / ETF
    velocity              accumulation           confirmation
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                ▼
              COMPOSITE: L1×30% + L2×35% + L3×35%
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            Score ≥ 60                Score < 40
            → BUY signal             → No action
                    │
                    ▼
          CLAUDE HAIKU NARRATIVE
          (top 4 signals only)
                    │
                    ▼
          DASHBOARD — 8-sector matrix
          Click → 3-layer drill-down
                    │
                    ▼
          EXECUTE ON SODEX
          EIP-712 sign via MetaMask
          Proxy submit server-side
          Stop-loss + take-profit attached
```

### Key Design Decisions

**Why 3 layers, not 1?**
Any single signal can be noise. VCs sometimes fund bad sectors. ETF flows can be manipulated. Macro events are unpredictable. But when all three align simultaneously, it's statistically much harder to fake. We require convergence, not correlation.

**Why L2 weighted highest (35%)?**
Corporate treasury companies and public crypto stocks represent the most capital-at-risk. When MSTR buys BTC and COIN rallies, real money is moving. This is a stronger signal than VC announcements (which are often PR-timed) or macro events (which are lagging indicators).

**Why Claude Haiku, not GPT-4?**
We generate narratives on every refresh cycle for top signals. Haiku is fast enough to not block the dashboard load and cheap enough to run continuously. The quality is sufficient for a 2-sentence data-grounded narrative — no creativity required, just synthesis.

**Why mock data fallback?**
Hackathon demos need to work 100% of the time. If SoSoValue is rate-limiting or SoDEX is down, the demo must still show the full product. All mock data is realistic and grounded in actual recent market events.

---

## 6. Early Prototype

### What is Built and Running

✅ **Conviction scoring engine** — 3-layer algorithm computing scores for 8 sectors in parallel  
✅ **SoSoValue API client** — all 9 modules integrated with TypeScript types  
✅ **SoDEX read client** — markets, tickers, orderbook  
✅ **SoDEX EIP-712 signer** — browser-side MetaMask signing + server-side order proxy  
✅ **Claude Haiku narrative layer** — generates sector narrative from real signal data  
✅ **Bloomberg-dark dashboard** — sector matrix → drill-down → execution modal  
✅ **Live SoDEX ticker** — scrolling price strip  
✅ **SoSoValue news feed** — live intelligence panel  
✅ **Clean production build** — `next build` passes with zero TypeScript errors  

### Demo Flow (3 clicks to execution)

1. **Open dashboard** → See 8 sectors ranked by conviction score, live ticker running
2. **Click a sector** (e.g. AI: 82/100) → Drill-down shows all 3 layers with data breakdown + Claude narrative
3. **Click "Execute on SoDEX"** → Execution modal with position size, stop-loss, take-profit → Sign with MetaMask → Order submitted

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 + React 19 + TypeScript |
| Styling | Tailwind CSS |
| Data | SoSoValue API (9 modules) |
| Execution | SoDEX API + EIP-712 (ethers v6) |
| AI | Claude Haiku (Anthropic SDK) |
| Deploy (Wave 2) | Vercel |

### Repository Structure

```
src/lib/conviction/engine.ts    ← Core scoring algorithm
src/lib/sosovalue/client.ts     ← SoSoValue API (9 modules)
src/lib/sodex/client.ts         ← SoDEX read endpoints
src/lib/sodex/signer.ts         ← EIP-712 signing
src/lib/claude.ts               ← Claude narrative generation
src/app/page.tsx                ← Main dashboard
src/app/api/conviction/         ← Scoring API route
src/app/api/execute/            ← SoDEX order proxy
```

---

## Wave 1 Progress Summary

| Deliverable | Status |
|-------------|--------|
| Idea direction defined | ✅ Complete |
| Target users identified | ✅ Complete |
| Use case definition | ✅ Complete |
| API usage plan | ✅ Complete |
| Workflow design | ✅ Complete |
| Early prototype | ✅ Complete — full working build |

---

## Contact

**Email:** oladayoahmod1122@gmail.com  
**GitHub:** [repo link]  
**Demo:** [live link — Wave 2 deployment]
