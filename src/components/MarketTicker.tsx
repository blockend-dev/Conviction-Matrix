"use client";
import { useEffect, useState } from "react";
import type { Ticker } from "@/lib/sodex/client";

export default function MarketTicker() {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});

  useEffect(() => {
    const load = () =>
      fetch("/api/markets")
        .then(r => r.json())
        .then(d => setTickers(d.tickers ?? {}))
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const entries = Object.values(tickers);
  if (!entries.length) return null;

  return (
    <div className="border-b border-terminal-border bg-terminal-surface overflow-hidden">
      <div className="flex items-center gap-0 animate-none">
        <div className="px-3 py-2 border-r border-terminal-border shrink-0">
          <span className="text-xs font-bold text-signal-strong tracking-widest">SODEX LIVE</span>
        </div>
        <div className="overflow-hidden flex-1">
          <div className="flex gap-8 px-4 py-2" style={{ animation: "ticker 40s linear infinite" }}>
            {[...entries, ...entries].map((t, i) => (
              <span key={`${t.market}-${i}`} className="text-xs whitespace-nowrap shrink-0">
                <span className="text-terminal-bright font-bold">{t.market}</span>
                <span className="text-terminal-text ml-2">${t.lastPrice.toLocaleString()}</span>
                <span className={`ml-1 ${t.change24h >= 0 ? "text-signal-strong" : "text-signal-none"}`}>
                  {t.change24h >= 0 ? "+" : ""}{t.change24h.toFixed(2)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
