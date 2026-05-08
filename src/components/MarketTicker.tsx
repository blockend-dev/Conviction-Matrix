"use client";
import { useEffect, useState } from "react";
import type { SpotTicker } from "@/lib/sodex/client";

export default function MarketTicker() {
  const [tickers, setTickers] = useState<SpotTicker[]>([]);

  useEffect(() => {
    const load = () =>
      fetch("/api/markets")
        .then(r => r.json())
        .then(d => {
          const map: Record<string, SpotTicker> = d.tickers ?? {};
          setTickers(Object.values(map));
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!tickers.length) return null;

  const items = [...tickers, ...tickers]; // double for seamless loop

  return (
    <div className="border-b border-terminal-border bg-terminal-surface overflow-hidden">
      <div className="flex items-center">
        <div className="px-3 py-2 border-r border-terminal-border shrink-0">
          <span className="text-xs font-bold text-signal-strong tracking-widest">SODEX LIVE</span>
        </div>
        <div className="overflow-hidden flex-1">
          <div className="flex gap-8 px-4 py-2" style={{ animation: "ticker 40s linear infinite" }}>
            {items.map((t, i) => {
              const pct   = parseFloat(t.priceChangePercent);
              const color = pct >= 0 ? "text-signal-strong" : "text-signal-none";
              return (
                <span key={`${t.symbol}-${i}`} className="text-xs whitespace-nowrap shrink-0">
                  <span className="text-terminal-bright font-bold">{t.symbol}</span>
                  <span className="text-terminal-text ml-2">${parseFloat(t.lastPrice).toLocaleString()}</span>
                  <span className={`ml-1 ${color}`}>
                    {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
