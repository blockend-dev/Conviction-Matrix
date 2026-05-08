"use client";
import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import type { ConvictionSignal } from "@/lib/types";
import { signOrderBrowser, submitOrder } from "@/lib/sodex/signer";

interface Props {
  signal: ConvictionSignal;
  onClose: () => void;
}

type Status = "idle" | "signing" | "submitting" | "success" | "error";

export default function ExecutionModal({ signal, onClose }: Props) {
  const token = signal.tokens[0] ?? "ETH";
  const market = `${token}-USDC`;

  const [size, setSize]           = useState("0.05");
  const [stopLoss, setStopLoss]   = useState("5");
  const [takeProfit, setTakeProfit] = useState("15");
  const [status, setStatus]       = useState<Status>("idle");
  const [orderId, setOrderId]     = useState("");
  const [error, setError]         = useState("");

  async function handleExecute() {
    setStatus("signing");
    setError("");
    try {
      const sig = await signOrderBrowser({ market, side: "BUY", orderType: "MARKET", size });
      setStatus("submitting");
      const accounts: string[] = await (window.ethereum as any).request({ method: "eth_accounts" });
      const result = await submitOrder({ market, side: "BUY", orderType: "MARKET", size }, sig, accounts[0]);
      setOrderId(result.orderId);
      setStatus("success");
    } catch (err: any) {
      setError(err.message ?? "Execution failed");
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6 w-full max-w-md space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-terminal-bright">Execute Trade — {market}</h3>
          <button onClick={onClose}><X size={18} className="text-terminal-text" /></button>
        </div>

        {/* Conviction summary */}
        <div className="bg-terminal-muted rounded-lg p-3 text-xs space-y-1">
          <p className="text-terminal-text">Conviction Score: <span className="text-signal-strong font-bold">{signal.overallScore}/100</span></p>
          <p className="text-terminal-text">Direction: <span className="text-signal-strong font-bold">{signal.direction}</span></p>
          <p className="text-terminal-text">Sector: <span className="text-terminal-bright">{signal.sector}</span></p>
        </div>

        {/* Size */}
        <div>
          <label className="text-xs text-terminal-text block mb-1">Position Size ({token})</label>
          <input
            type="number" step="0.001" min="0.001" value={size}
            onChange={e => setSize(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-terminal-bright text-sm font-mono focus:outline-none focus:border-signal-strong"
          />
        </div>

        {/* Risk params */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-terminal-text block mb-1">Stop Loss (%)</label>
            <input
              type="number" step="0.5" min="1" max="50" value={stopLoss}
              onChange={e => setStopLoss(e.target.value)}
              className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-signal-none text-sm font-mono focus:outline-none focus:border-signal-none"
            />
          </div>
          <div>
            <label className="text-xs text-terminal-text block mb-1">Take Profit (%)</label>
            <input
              type="number" step="0.5" min="1" max="200" value={takeProfit}
              onChange={e => setTakeProfit(e.target.value)}
              className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-signal-strong text-sm font-mono focus:outline-none focus:border-signal-strong"
            />
          </div>
        </div>

        {/* Testnet warning */}
        <div className="flex items-start gap-2 bg-signal-neutral/10 border border-signal-neutral/30 rounded-lg p-3">
          <AlertTriangle size={14} className="text-signal-neutral mt-0.5 shrink-0" />
          <p className="text-xs text-signal-neutral">Executing on SoDEX testnet. No real funds involved. Connect a testnet wallet to proceed.</p>
        </div>

        {/* Error */}
        {status === "error" && (
          <p className="text-xs text-signal-none bg-signal-none/10 border border-signal-none/30 rounded p-2">{error}</p>
        )}

        {/* Success */}
        {status === "success" && (
          <p className="text-xs text-signal-strong bg-signal-strong/10 border border-signal-strong/30 rounded p-2">
            ✓ Order submitted! ID: {orderId}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-terminal-border text-terminal-text text-sm hover:bg-terminal-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={["signing", "submitting", "success"].includes(status)}
            className="flex-1 py-2.5 rounded-lg bg-signal-strong/20 border border-signal-strong text-signal-strong font-bold text-sm hover:bg-signal-strong/30 disabled:opacity-50"
          >
            {status === "signing"    ? "Signing..." :
             status === "submitting" ? "Sending..." :
             status === "success"    ? "✓ Done" :
             "Confirm & Execute"}
          </button>
        </div>
      </div>
    </div>
  );
}
