"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { SectorAccuracy, AccuracyStat, ModelWeights } from "@/lib/ledger/accuracy";
import type { StoredPrediction } from "@/lib/ledger/store";

interface SummaryData {
  accuracy: SectorAccuracy[];
  predictions: StoredPrediction[];
  total: number;
  ledgerEnabled: boolean;
  timestamp: string;
}

interface WeightsData {
  current: ModelWeights;
  history: ModelWeights[];
}

function StatBadge({ stat, compact = false }: { stat: AccuracyStat; compact?: boolean }) {
  if (stat.label === "INSUFFICIENT") {
    return (
      <span className="text-terminal-text/40 text-xs font-mono">
        {compact ? "—" : `n=${stat.total}`}
      </span>
    );
  }
  const pct = Math.round(stat.wilsonLower * 100);
  return (
    <span className={clsx(
      "text-xs font-mono font-bold",
      stat.label === "HIGH"     && "text-signal-strong",
      stat.label === "MODERATE" && "text-signal-mild",
      stat.label === "LOW"      && "text-signal-weak",
    )}>
      {pct}%{compact ? "" : `+ (n=${stat.total})`}
    </span>
  );
}

function VerifiedBadge({ verified }: { verified: boolean | null }) {
  if (verified === null) return <span className="text-xs text-terminal-text/40">pending</span>;
  return (
    <span className={clsx(
      "text-xs font-mono font-bold",
      verified ? "text-signal-strong" : "text-signal-none"
    )}>
      {verified ? "✓ VERIFIED" : "✗ DISCONF"}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function VerifyPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [weights, setWeights] = useState<WeightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"accuracy" | "ledger" | "weights">("accuracy");

  useEffect(() => {
    Promise.all([
      fetch("/api/verify/summary").then(r => r.json()),
      fetch("/api/weights/current").then(r => r.json()),
    ]).then(([s, w]) => {
      setSummary(s);
      setWeights(w);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-terminal-bg text-terminal-text flex items-center justify-center">
        <p className="text-terminal-text/60 font-mono animate-pulse">Loading verification data…</p>
      </div>
    );
  }

  if (!summary?.ledgerEnabled) {
    return (
      <div className="min-h-screen bg-terminal-bg text-terminal-text p-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-xs text-terminal-text/50 hover:text-terminal-bright mb-6 block">← Back to dashboard</Link>
          <h1 className="text-2xl font-black text-terminal-bright mb-4">◈ Verification Engine</h1>
          <div className="border border-terminal-border rounded-lg p-6 bg-terminal-surface">
            <p className="text-signal-weak font-mono mb-3">POSTGRES_URL not configured</p>
            <p className="text-sm text-terminal-text mb-4">
              The prediction ledger requires a Postgres database. Add <code className="text-terminal-bright">POSTGRES_URL</code> to your environment variables, then call <code className="text-terminal-bright">/api/setup?secret=YOUR_CRON_SECRET</code> to initialise.
            </p>
            <ol className="text-xs text-terminal-text/70 space-y-1 list-decimal list-inside">
              <li>Create a Postgres database (Vercel Postgres, Neon, Supabase)</li>
              <li>Add POSTGRES_URL and CRON_SECRET to .env.local</li>
              <li>Call GET /api/setup?secret=CRON_SECRET</li>
              <li>Every conviction call now logs a prediction automatically</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  const sectors = summary.accuracy;

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text">
      {/* Header */}
      <div className="border-b border-terminal-border bg-terminal-surface px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/" className="text-xs text-terminal-text/50 hover:text-terminal-bright block mb-1">← Back to dashboard</Link>
            <h1 className="text-xl font-black text-terminal-bright">◈ Conviction Verification Engine</h1>
            <p className="text-xs text-terminal-text/60 mt-0.5">
              Every conviction call is a thesis. We verify each one against subsequent capital flow data.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-signal-strong">{summary.total.toLocaleString()}</p>
            <p className="text-xs text-terminal-text/50">total predictions logged</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-terminal-border bg-terminal-surface px-6">
        <div className="max-w-6xl mx-auto flex gap-6">
          {(["accuracy", "ledger", "weights"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                "py-3 text-sm font-mono uppercase tracking-wider border-b-2 transition-colors",
                activeTab === tab
                  ? "border-signal-strong text-terminal-bright"
                  : "border-transparent text-terminal-text/50 hover:text-terminal-text"
              )}
            >
              {tab === "accuracy" ? "Accuracy Stats" : tab === "ledger" ? "Prediction Ledger" : "Weight History"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* ACCURACY TAB */}
        {activeTab === "accuracy" && (
          <div className="space-y-6">
            {/* Summary callout */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Predictions Logged", value: summary.total.toLocaleString() },
                { label: "Verified (7d)", value: summary.predictions.filter(p => p.thesisVerified7d === true).length },
                { label: "Disconfirmed (7d)", value: summary.predictions.filter(p => p.thesisVerified7d === false).length },
                { label: "Pending Resolution", value: summary.predictions.filter(p => p.thesisVerified7d === null).length },
              ].map(stat => (
                <div key={stat.label} className="border border-terminal-border rounded-lg p-4 bg-terminal-surface">
                  <p className="text-2xl font-black text-terminal-bright">{stat.value}</p>
                  <p className="text-xs text-terminal-text/60 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Per-sector accuracy table */}
            <div className="border border-terminal-border rounded-lg overflow-hidden">
              <div className="bg-terminal-surface border-b border-terminal-border px-4 py-3">
                <p className="text-xs font-mono text-terminal-text/60 uppercase tracking-wider">
                  Sector Accuracy — Wilson 95% CI Lower Bound
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-terminal-border">
                      <th className="text-left px-4 py-3 text-xs font-mono text-terminal-text/50 uppercase">Sector</th>
                      <th className="text-center px-3 py-3 text-xs font-mono text-terminal-text/50 uppercase">7d Combined</th>
                      <th className="text-center px-3 py-3 text-xs font-mono text-terminal-text/50 uppercase">7d ETF</th>
                      <th className="text-center px-3 py-3 text-xs font-mono text-terminal-text/50 uppercase">7d Treasury</th>
                      <th className="text-center px-3 py-3 text-xs font-mono text-terminal-text/50 uppercase">7d Macro</th>
                      <th className="text-center px-3 py-3 text-xs font-mono text-terminal-text/50 uppercase">30d Combined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectors.map(s => (
                      <tr key={s.sector} className="border-b border-terminal-border/50 hover:bg-terminal-surface">
                        <td className="px-4 py-3 font-bold text-terminal-bright">{s.sector}</td>
                        <td className="px-3 py-3 text-center"><StatBadge stat={s.horizon7.combined} compact /></td>
                        <td className="px-3 py-3 text-center"><StatBadge stat={s.horizon7.etf} compact /></td>
                        <td className="px-3 py-3 text-center"><StatBadge stat={s.horizon7.treasury} compact /></td>
                        <td className="px-3 py-3 text-center"><StatBadge stat={s.horizon7.macro} compact /></td>
                        <td className="px-3 py-3 text-center"><StatBadge stat={s.horizon30.combined} compact /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Methodology note */}
            <div className="border border-terminal-border/50 rounded-lg p-4 text-xs text-terminal-text/60 space-y-1">
              <p className="font-mono text-terminal-text/40 uppercase mb-2">Verification Criteria (published)</p>
              <p>ETF layer: net flow ≥ 50% of original signal strength at horizon date</p>
              <p>Treasury layer: BTC purchases &gt; 0 during horizon window</p>
              <p>Macro layer: macro score within ±15 points of original</p>
              <p>Verified: ≥ 2/3 layer conditions confirm. Wilson lower bound is conservative at 95% CI.</p>
            </div>
          </div>
        )}

        {/* LEDGER TAB */}
        {activeTab === "ledger" && (
          <div className="border border-terminal-border rounded-lg overflow-hidden">
            <div className="bg-terminal-surface border-b border-terminal-border px-4 py-3 flex justify-between items-center">
              <p className="text-xs font-mono text-terminal-text/60 uppercase tracking-wider">Prediction Ledger</p>
              <p className="text-xs text-terminal-text/40">Showing last 60 predictions</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-terminal-border">
                    <th className="text-left px-4 py-3 font-mono text-terminal-text/50 uppercase">Time</th>
                    <th className="text-left px-3 py-3 font-mono text-terminal-text/50 uppercase">Sector</th>
                    <th className="text-center px-3 py-3 font-mono text-terminal-text/50 uppercase">Score</th>
                    <th className="text-left px-3 py-3 font-mono text-terminal-text/50 uppercase">Direction</th>
                    <th className="text-center px-3 py-3 font-mono text-terminal-text/50 uppercase">7d</th>
                    <th className="text-center px-3 py-3 font-mono text-terminal-text/50 uppercase">30d</th>
                    <th className="text-left px-3 py-3 font-mono text-terminal-text/50 uppercase">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.predictions.map(p => (
                    <tr key={p.id} className="border-b border-terminal-border/30 hover:bg-terminal-surface">
                      <td className="px-4 py-2 text-terminal-text/60">{fmtDate(p.createdAt)}</td>
                      <td className="px-3 py-2 font-bold text-terminal-bright">{p.sector}</td>
                      <td className="px-3 py-2 text-center font-black">{p.score}</td>
                      <td className={clsx(
                        "px-3 py-2 font-mono text-xs",
                        (p.direction === "STRONG_BUY" || p.direction === "BUY") && "text-signal-strong",
                        p.direction === "NEUTRAL" && "text-signal-neutral",
                        (p.direction === "SELL" || p.direction === "STRONG_SELL") && "text-signal-none",
                      )}>
                        {p.direction}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <VerifiedBadge verified={p.thesisVerified7d ?? null} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <VerifiedBadge verified={p.thesisVerified30d ?? null} />
                      </td>
                      <td className="px-3 py-2 font-mono text-terminal-text/30 text-xs">
                        {p.rawSignalHash?.slice(0, 8)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WEIGHTS TAB */}
        {activeTab === "weights" && weights && (
          <div className="space-y-6">
            {/* Current weights */}
            <div className="border border-terminal-border rounded-lg p-6 bg-terminal-surface">
              <p className="text-xs font-mono text-terminal-text/50 uppercase mb-4">Current Model Weights</p>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  { label: "L1 Fundraising", value: weights.current.l1, color: "text-signal-strong" },
                  { label: "L2 Institutional", value: weights.current.l2, color: "text-signal-mild" },
                  { label: "L3 Macro/ETF", value: weights.current.l3, color: "text-signal-neutral" },
                ].map(w => (
                  <div key={w.label} className="text-center">
                    <p className={clsx("text-3xl font-black", w.color)}>
                      {Math.round(w.value * 100)}%
                    </p>
                    <p className="text-xs text-terminal-text/50 mt-1">{w.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-terminal-text/50 border-t border-terminal-border pt-3">
                {weights.current.note ?? "Default weights. Calibration begins after 20+ predictions per sector."}
              </p>
              <p className="text-xs text-terminal-text/30 mt-1">
                Effective: {fmtDate(weights.current.effectiveFrom)} · Sample: n={weights.current.sampleSize}
              </p>
            </div>

            {/* Weight history */}
            {weights.history.length > 0 ? (
              <div className="border border-terminal-border rounded-lg overflow-hidden">
                <div className="bg-terminal-surface border-b border-terminal-border px-4 py-3">
                  <p className="text-xs font-mono text-terminal-text/60 uppercase tracking-wider">Weight Calibration History</p>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-terminal-border">
                      <th className="text-left px-4 py-3 font-mono text-terminal-text/50 uppercase">Date</th>
                      <th className="text-center px-3 py-3 font-mono text-terminal-text/50">L1</th>
                      <th className="text-center px-3 py-3 font-mono text-terminal-text/50">L2</th>
                      <th className="text-center px-3 py-3 font-mono text-terminal-text/50">L3</th>
                      <th className="text-center px-3 py-3 font-mono text-terminal-text/50">n</th>
                      <th className="text-left px-3 py-3 font-mono text-terminal-text/50">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weights.history.map((w, i) => (
                      <tr key={i} className="border-b border-terminal-border/30 hover:bg-terminal-surface">
                        <td className="px-4 py-2 text-terminal-text/60">{fmtDate(w.effectiveFrom)}</td>
                        <td className="px-3 py-2 text-center text-signal-strong">{Math.round(w.l1 * 100)}%</td>
                        <td className="px-3 py-2 text-center text-signal-mild">{Math.round(w.l2 * 100)}%</td>
                        <td className="px-3 py-2 text-center text-signal-neutral">{Math.round(w.l3 * 100)}%</td>
                        <td className="px-3 py-2 text-center text-terminal-text/60">{w.sampleSize}</td>
                        <td className="px-3 py-2 text-terminal-text/50 max-w-xs truncate">{w.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border border-terminal-border rounded-lg p-6 text-center">
                <p className="text-terminal-text/40 text-sm">No weight calibrations yet.</p>
                <p className="text-terminal-text/30 text-xs mt-1">Calibration runs weekly after 20+ predictions per sector accumulate.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
