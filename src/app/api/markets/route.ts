import { NextResponse } from "next/server";
import { getMarkets, mockMarkets } from "@/lib/sodex/client";
import { getTicker, mockTickers } from "@/lib/sodex/client";

const USE_MOCK = !process.env.SODEX_BASE_URL || process.env.SODEX_BASE_URL.includes("your_");

export async function GET() {
  try {
    const markets = USE_MOCK ? mockMarkets : await getMarkets().catch(() => mockMarkets);
    const tickerData = USE_MOCK
      ? mockTickers
      : Object.fromEntries(
          await Promise.all(
            markets.map(async (m) => [m.market, await getTicker(m.market).catch(() => mockTickers[m.market])])
          )
        );
    return NextResponse.json({ markets, tickers: tickerData });
  } catch (err) {
    return NextResponse.json({ markets: mockMarkets, tickers: mockTickers, error: String(err) });
  }
}
