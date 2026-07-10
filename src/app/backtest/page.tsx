"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Activity, RefreshCw } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import type { Sector } from "@/lib/types";
import type { SectorAccuracy, AccuracyStat } from "@/lib/ledger/accuracy";
import type { StoredPrediction } from "@/lib/ledger/store";

const SECTORS: Sector[] = ["AI", "DePIN", "RWA", "DeFi", "L2", "L1", "GameFi", "Meme"];

// ── Types ──────────────────────────────────────────────────────────────────────

interface SummaryData {
  accuracy: SectorAccuracy[];
  predictions: StoredPrediction[];
  totalCount: number;
  ledgerEnabled: boolean;
}

interface TierStats {
  winRate: number;
  avgReturn: number;
  count: number;
  wilsonLower: number;
  label: AccuracyStat["label"];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function statToTier(stat: AccuracyStat): TierStats {
  return {
    winRate: Math.round(stat.rate * 100),
    avgReturn: 0, // not tracked in ledger — we track thesis accuracy not price returns
    count: stat.total,
    wilsonLower: stat.wilsonLower,
    label: stat.label,
  };
}

function labelColor(label: AccuracyStat["label"]): string {
  if (label === "HIGH")     return "text-signal-strong";
  if (label === "MODERATE") return "text-signal-mild";
  if (label === "LOW")      return "text-signal-none";
  return "text-terminal-text";
}

function directionBg(direction: string): string {
  if (direction === "STRONG_BUY") return "text-signal-strong";
  if (direction === "BUY")        return "text-signal-mild";
  if (direction === "NEUTRAL")    return "text-signal-neutral";
  return "text-signal-none";
}

// Build chart data: prediction points sorted by date, with a rolling verify rate
function buildChartData(predictions: StoredPrediction[]) {
  const sorted = [...predictions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let cumVerified = 0;
  let cumTotal = 0;

  return sorted.map((p, i) => {
    const has7d = p.verifiedAt7d !== null;
    if (has7d) {
      cumTotal++;
      if (p.thesisVerified7d) cumVerified++;
    }
    const rollingRate = cumTotal > 0 ? Math.round((cumVerified / cumTotal) * 100) : null;
    const date = new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
      index: i,
      date,
      score: p.score,
      verified7d: p.thesisVerified7d === null ? null : (p.thesisVerified7d ? 1 : 0),
      rollingRate,
    };
  });
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

const CustomTooltip = ({
  active, payload, label,
}: { active?: boolean; payload?: { name: string; value: number | null }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded-lg p-3 text-xs space-y-1">
      <p className="text-terminal-text mb-1">{label}</p>
      {payload.filter(p => p.value !== null).map(p => (
        <p key={p.name} className="text-terminal-bright">
          {p.name === "score"       ? "Conviction" :
           p.name === "rollingRate" ? "Rolling Verify Rate" : "Thesis Verified?"}
          {": "}
          <span className={p.name === "rollingRate" ? "text-signal-strong" : "text-terminal-bright"}>
            {p.name === "score"       ? `${p.value}/100` :
             p.name === "rollingRate" ? `${p.value}%` :
             p.value === 1            ? "✓ YES" : "✗ NO"}
          </span>
        </p>
      ))}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BacktestPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSector, setActiveSector] = useState<Sector>("AI");

  useEffect(() => {
    fetch("/api/verify/summary")
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sectorMap = useMemo(() => {
    if (!data) return {} as Record<string, SectorAccuracy>;
    return Object.fromEntries(data.accuracy.map(s => [s.sector, s]));
  }, [data]);

  const activePredictions = useMemo(() => {
    if (!data) return [];
    return data.predictions.filter(p => p.sector === activeSector);
  }, [data, activeSector]);

  const chartData = useMemo(() => buildChartData(activePredictions), [activePredictions]);

  const overallStat = useMemo(() => {
    if (!data?.accuracy.length) return null;
    const combined = data.accuracy.flatMap(s => [
      s.horizon7.combined.total, s.horizon7.combined.confirmed
    ]);
    const total     = combined.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
    const confirmed = combined.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0);
    if (total === 0) return null;
    return { total, confirmed, rate: Math.round((confirmed / total) * 100) };
  }, [data]);

  const signalLog = useMemo(() => {
    if (!data?.predictions) return [];
    return [...data.predictions]
      .filter(p => p.verifiedAt7d !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 80);
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-terminal-text text-sm">
          <RefreshCw size={14} className="animate-spin" />
          Loading track record…
        </div>
      </div>
    );
  }

  // No ledger connected yet
  if (!data?.ledgerEnabled || data.totalCount === 0) {
    return (
      <div className="min-h-screen bg-terminal-bg">
        <header className="border-b border-terminal-border px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-terminal-text hover:text-terminal-bright text-xs transition-colors">
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <div>
              <h1 className="text-xl font-black text-terminal-bright tracking-tight">◈ TRACK RECORD</h1>
              <p className="text-xs text-terminal-text mt-0.5">Real prediction verification — every call checked against live SoSoValue data</p>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center gap-6 text-center">
          <Activity size={40} className="text-terminal-text opacity-40" />
          <div className="space-y-2">
            <p className="text-terminal-bright font-bold text-lg">Track record is building</p>
            <p className="text-terminal-text text-sm max-w-md">
              Conviction calls are logged as structured predictions and verified against SoSoValue capital flow data at T+7 and T+30.
            </p>
          </div>
          <div className="border border-terminal-border rounded-xl p-5 bg-terminal-surface text-left max-w-lg w-full space-y-3 text-xs text-terminal-text">
            <p className="text-terminal-bright font-bold tracking-wider">TO ENABLE PREDICTION LEDGER</p>
            <ol className="space-y-2 list-decimal list-inside">
              <li>Add <code className="text-signal-mild">POSTGRES_URL</code> to <code>.env.local</code> (Vercel Postgres, Neon, or Supabase)</li>
              <li>Set <code className="text-signal-mild">CRON_SECRET</code> to any random string</li>
              <li>Call <code className="text-signal-mild">GET /api/setup?secret=YOUR_CRON_SECRET</code> to run migration + seed 90 days of history</li>
              <li>Vercel Cron re-verifies predictions every 4h automatically</li>
            </ol>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-terminal-bg">
      <header className="border-b border-terminal-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-terminal-text hover:text-terminal-bright text-xs transition-colors">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div>
            <h1 className="text-xl font-black text-terminal-bright tracking-tight">◈ TRACK RECORD</h1>
            <p className="text-xs text-terminal-text mt-0.5">
              {data.totalCount} logged predictions · {overallStat ? `${overallStat.rate}% thesis confirmation rate` : "building…"} · verified against live SoSoValue data
            </p>
          </div>
          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded text-signal-strong bg-signal-strong/10">
            ● LIVE DATA
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Overall tier accuracy cards */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-terminal-text tracking-widest">
            THESIS CONFIRMATION BY SECTOR — 7-DAY HORIZON (WILSON 95% CI)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SECTORS.slice(0, 4).map(sector => {
              const acc = sectorMap[sector]?.horizon7.combined;
              return (
                <StatCard
                  key={sector}
                  label={sector}
                  stat={acc ?? null}
                  onClick={() => setActiveSector(sector)}
                  active={activeSector === sector}
                />
              );
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SECTORS.slice(4).map(sector => {
              const acc = sectorMap[sector]?.horizon7.combined;
              return (
                <StatCard
                  key={sector}
                  label={sector}
                  stat={acc ?? null}
                  onClick={() => setActiveSector(sector)}
                  active={activeSector === sector}
                />
              );
            })}
          </div>
        </div>

        {/* Per-sector chart */}
        <div className="border border-terminal-border rounded-xl p-5 bg-terminal-surface space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-bold text-terminal-text tracking-widest">
                CONVICTION SCORE + ROLLING VERIFICATION RATE
              </p>
              <p className="text-xs text-terminal-text mt-0.5">
                {activeSector} sector · {activePredictions.length} predictions logged
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map(s => (
                <button
                  key={s}
                  onClick={() => setActiveSector(s)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    activeSector === s
                      ? "bg-terminal-muted border-terminal-bright text-terminal-bright"
                      : "border-terminal-border text-terminal-text hover:text-terminal-bright"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#1a2d3d" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#8fb3cc", fontSize: 10 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="score"
                  domain={[0, 100]}
                  tick={{ fill: "#8fb3cc", fontSize: 10 }}
                  tickLine={false}
                  width={28}
                />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: "#8fb3cc", fontSize: 10 }}
                  tickLine={false}
                  width={36}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine yAxisId="score" y={75} stroke="#00ff8830" strokeDasharray="4 4" />
                <ReferenceLine yAxisId="score" y={60} stroke="#ffd70020" strokeDasharray="4 4" />
                <Line
                  yAxisId="score"
                  type="monotone"
                  dataKey="score"
                  stroke="#c8e6f5"
                  strokeWidth={1.5}
                  dot={false}
                  name="score"
                />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="rollingRate"
                  stroke="#00ff88"
                  strokeWidth={2}
                  dot={false}
                  name="rollingRate"
                  strokeDasharray="5 3"
                  connectNulls
                />
                <Legend
                  formatter={(v: string) =>
                    v === "score" ? "Conviction Score" : "Rolling Confirm Rate %"
                  }
                  wrapperStyle={{ fontSize: "11px", color: "#8fb3cc", paddingTop: "8px" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-terminal-text text-xs">
              No predictions logged for {activeSector} yet
            </div>
          )}
        </div>

        {/* Layer breakdown table */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-terminal-text tracking-widest">SECTOR LAYER ACCURACY — 7-DAY HORIZON</p>
          <div className="border border-terminal-border rounded-xl bg-terminal-surface overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-terminal-border text-terminal-text font-bold">
                  <th className="text-left px-4 py-2">SECTOR</th>
                  <th className="text-center px-3 py-2">COMBINED</th>
                  <th className="text-center px-3 py-2">ETF FLOW</th>
                  <th className="text-center px-3 py-2">TREASURY</th>
                  <th className="text-center px-3 py-2">MACRO</th>
                  <th className="text-center px-3 py-2">SAMPLES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {SECTORS.map(sector => {
                  const acc = sectorMap[sector]?.horizon7;
                  if (!acc) return null;
                  return (
                    <tr key={sector} className="hover:bg-terminal-muted transition-colors">
                      <td className="px-4 py-2.5 text-terminal-bright font-bold">{sector}</td>
                      <td className="px-3 py-2.5 text-center">
                        <StatPill stat={acc.combined} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatPill stat={acc.etf} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatPill stat={acc.treasury} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatPill stat={acc.macro} />
                      </td>
                      <td className="px-3 py-2.5 text-center text-terminal-text">
                        {acc.combined.total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-terminal-text">
            Wilson 95% CI lower bound — conservative estimate that accounts for sample size.
            HIGH &gt;70% · MODERATE &gt;55% · LOW ≤55% · INSUFFICIENT &lt;10 samples.
          </p>
        </div>

        {/* Verified prediction log */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-terminal-text tracking-widest">
            VERIFIED PREDICTION LOG — LAST {signalLog.length} CALLS
          </p>
          <div className="border border-terminal-border rounded-xl bg-terminal-surface overflow-hidden">
            <div className="grid grid-cols-6 gap-2 px-4 py-2 border-b border-terminal-border text-xs text-terminal-text font-bold">
              <span>DATE</span>
              <span>SECTOR</span>
              <span>SCORE</span>
              <span>DIRECTION</span>
              <span>7d THESIS</span>
              <span>30d THESIS</span>
            </div>
            <div className="divide-y divide-terminal-border max-h-96 overflow-y-auto">
              {signalLog.length === 0 ? (
                <div className="px-4 py-6 text-center text-terminal-text text-xs">
                  No verified predictions yet — verification runs every 4 hours
                </div>
              ) : (
                signalLog.map(p => (
                  <div key={p.id} className="grid grid-cols-6 gap-2 px-4 py-2 text-xs hover:bg-terminal-muted transition-colors">
                    <span className="text-terminal-text">
                      {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-terminal-bright font-bold">{p.sector}</span>
                    <span className="text-terminal-bright font-bold tabular-nums">{p.score}</span>
                    <span className={`font-bold ${directionBg(p.direction)}`}>
                      {p.direction.replace("_", " ")}
                    </span>
                    <VerifiedBadge verified={p.thesisVerified7d} components={p.componentsConfirmed7d} />
                    <VerifiedBadge verified={p.thesisVerified30d} />
                  </div>
                ))
              )}
            </div>
          </div>
          <p className="text-xs text-terminal-text">
            Thesis confirmed = ≥2/3 conditions met at horizon: ETF flow ≥50% original direction · any BTC purchases · macro score ±15 pts.
          </p>
        </div>

      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label, stat, onClick, active,
}: {
  label: string;
  stat: AccuracyStat | null;
  onClick: () => void;
  active: boolean;
}) {
  const pct = stat && stat.total >= 10
    ? Math.round(stat.wilsonLower * 100)
    : null;
  const color = stat ? labelColor(stat.label) : "text-terminal-text";

  return (
    <button
      onClick={onClick}
      className={`border rounded-xl p-4 bg-terminal-surface space-y-2 text-left transition-all ${
        active
          ? "border-terminal-bright"
          : "border-terminal-border hover:border-terminal-text"
      }`}
    >
      <p className="text-xs font-bold text-terminal-text tracking-wider">{label}</p>
      {pct !== null ? (
        <div className="space-y-0.5">
          <p className={`text-2xl font-black ${color}`}>{pct}%<span className="text-xs font-normal ml-1">+</span></p>
          <p className="text-xs text-terminal-text">Wilson lower · n={stat!.total}</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          <p className="text-sm text-terminal-text">—</p>
          <p className="text-xs text-terminal-text">n={stat?.total ?? 0}</p>
        </div>
      )}
    </button>
  );
}

function StatPill({ stat }: { stat: AccuracyStat }) {
  if (stat.total < 10) {
    return <span className="text-terminal-text opacity-50">—</span>;
  }
  return (
    <span className={`font-bold tabular-nums ${labelColor(stat.label)}`}>
      {Math.round(stat.wilsonLower * 100)}%+
    </span>
  );
}

function VerifiedBadge({
  verified, components,
}: { verified: boolean | null; components?: number | null }) {
  if (verified === null) return <span className="text-terminal-text opacity-50">pending</span>;
  if (verified)
    return (
      <span className="text-signal-strong font-bold">
        ✓ {components !== undefined && components !== null ? `${components}/3` : "CONF"}
      </span>
    );
  return (
    <span className="text-signal-none font-bold">
      ✗ {components !== undefined && components !== null ? `${components}/3` : "DISC"}
    </span>
  );
}
