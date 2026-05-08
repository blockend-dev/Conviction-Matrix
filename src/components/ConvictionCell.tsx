"use client";
import clsx from "clsx";
import ScoreBar from "./ScoreBar";
import DirectionBadge from "./DirectionBadge";
import type { ConvictionSignal } from "@/lib/types";

interface Props {
  signal: ConvictionSignal;
  onClick: (s: ConvictionSignal) => void;
  active: boolean;
}

const SECTOR_EMOJI: Record<string, string> = {
  AI: "🤖", DePIN: "📡", RWA: "🏦", DeFi: "💱",
  L2: "⚡", L1: "🔷", GameFi: "🎮", Meme: "🐸",
};

export default function ConvictionCell({ signal, onClick, active }: Props) {
  const glowClass =
    signal.overallScore >= 75 ? "glow-green border-signal-strong/40" :
    signal.overallScore >= 60 ? "glow-green border-signal-mild/30" :
    signal.overallScore >= 40 ? "glow-yellow border-signal-neutral/30" :
    "glow-red border-signal-none/30";

  return (
    <button
      onClick={() => onClick(signal)}
      className={clsx(
        "conviction-cell w-full text-left p-4 rounded-lg border bg-terminal-surface",
        "hover:bg-terminal-muted transition-colors",
        glowClass,
        active && "ring-1 ring-terminal-bright"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-bold text-terminal-bright">
          {SECTOR_EMOJI[signal.sector] ?? "◈"} {signal.sector}
        </span>
        <span className={clsx(
          "text-2xl font-black",
          signal.overallScore >= 75 ? "text-signal-strong" :
          signal.overallScore >= 60 ? "text-signal-mild" :
          signal.overallScore >= 40 ? "text-signal-neutral" :
          signal.overallScore >= 25 ? "text-signal-weak" :
          "text-signal-none"
        )}>
          {signal.overallScore}
        </span>
      </div>

      {/* 3 Layer bars */}
      <div className="space-y-2 mb-3">
        <ScoreBar score={signal.layer1Score} label="L1 Fundraising" size="sm" />
        <ScoreBar score={signal.layer2Score} label="L2 Institutional" size="sm" />
        <ScoreBar score={signal.layer3Score} label="L3 Macro/ETF" size="sm" />
      </div>

      {/* Direction */}
      <DirectionBadge direction={signal.direction} />

      {/* Top tokens */}
      <div className="mt-2 flex flex-wrap gap-1">
        {signal.tokens.slice(0, 3).map(t => (
          <span key={t} className="text-xs text-terminal-text bg-terminal-muted px-1.5 py-0.5 rounded">
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}
