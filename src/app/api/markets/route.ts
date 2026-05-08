import { NextResponse } from "next/server";
import { getTickers, mockTickers, getSymbols, mockSymbols } from "@/lib/sodex/client";

export async function GET() {
  try {
    const [tickers, symbols] = await Promise.all([
      getTickers().catch(() => mockTickers),
      getSymbols().catch(() => mockSymbols),
    ]);

    // Index tickers by symbol for easy lookup
    const tickerMap = Array.isArray(tickers)
      ? Object.fromEntries(tickers.map(t => [t.symbol, t]))
      : Object.fromEntries(mockTickers.map(t => [t.symbol, t]));

    return NextResponse.json({ symbols, tickers: tickerMap });
  } catch {
    const tickerMap = Object.fromEntries(mockTickers.map(t => [t.symbol, t]));
    return NextResponse.json({ symbols: mockSymbols, tickers: tickerMap });
  }
}
