// SoDEX API client — read endpoints are public, write endpoints require EIP-712 signing
const BASE_URL = process.env.SODEX_BASE_URL ?? "https://api.sodex.com";

async function getPublic<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`SoDEX API error ${res.status}: ${path}`);
  const json = await res.json();
  return json.data ?? json;
}

// ── Public read endpoints ────────────────────────────────────────────────────

export const getMarkets = () => getPublic<Market[]>("/v1/markets");
export const getOrderbook = (market: string, depth = 20) =>
  getPublic<Orderbook>(`/v1/markets/${market}/orderbook`, { depth });
export const getKlines = (market: string, interval: string, limit = 200) =>
  getPublic<Kline[]>(`/v1/markets/${market}/klines`, { interval, limit });
export const getTicker = (market: string) =>
  getPublic<Ticker>(`/v1/markets/${market}/ticker`);
export const getRecentTrades = (market: string, limit = 50) =>
  getPublic<Trade[]>(`/v1/markets/${market}/trades`, { limit });

// ── Mock data for demo ───────────────────────────────────────────────────────

export const mockMarkets: Market[] = [
  { market: "BTC-USDC", baseAsset: "BTC", quoteAsset: "USDC", minOrderSize: 0.001, tickSize: 0.1 },
  { market: "ETH-USDC", baseAsset: "ETH", quoteAsset: "USDC", minOrderSize: 0.01, tickSize: 0.01 },
  { market: "SOL-USDC", baseAsset: "SOL", quoteAsset: "USDC", minOrderSize: 0.1, tickSize: 0.001 },
  { market: "ARB-USDC", baseAsset: "ARB", quoteAsset: "USDC", minOrderSize: 1, tickSize: 0.0001 },
  { market: "ONDO-USDC", baseAsset: "ONDO", quoteAsset: "USDC", minOrderSize: 1, tickSize: 0.001 },
  { market: "RENDER-USDC", baseAsset: "RENDER", quoteAsset: "USDC", minOrderSize: 1, tickSize: 0.001 },
];

export const mockTickers: Record<string, Ticker> = {
  "BTC-USDC":     { market: "BTC-USDC", lastPrice: 91_200, change24h: 2.4, volume24h: 1_840_000_000, high24h: 92_100, low24h: 89_800 },
  "ETH-USDC":     { market: "ETH-USDC", lastPrice: 3_420, change24h: 3.1, volume24h: 890_000_000, high24h: 3_480, low24h: 3_310 },
  "SOL-USDC":     { market: "SOL-USDC", lastPrice: 148.5, change24h: 4.8, volume24h: 320_000_000, high24h: 152.0, low24h: 141.2 },
  "ARB-USDC":     { market: "ARB-USDC", lastPrice: 1.24, change24h: 1.9, volume24h: 45_000_000, high24h: 1.29, low24h: 1.19 },
  "ONDO-USDC":    { market: "ONDO-USDC", lastPrice: 1.82, change24h: 3.4, volume24h: 28_000_000, high24h: 1.87, low24h: 1.74 },
  "RENDER-USDC":  { market: "RENDER-USDC", lastPrice: 8.74, change24h: 6.2, volume24h: 52_000_000, high24h: 9.05, low24h: 8.12 },
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface Market {
  market: string;
  baseAsset: string;
  quoteAsset: string;
  minOrderSize: number;
  tickSize: number;
}

export interface Orderbook {
  bids: [number, number][];   // [price, size]
  asks: [number, number][];
  timestamp: number;
}

export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  market: string;
  lastPrice: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export interface Trade {
  id: string;
  price: number;
  size: number;
  side: "buy" | "sell";
  timestamp: number;
}
