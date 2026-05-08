const BASE_URL = process.env.SOSOVALUE_BASE_URL ?? "https://api.sosovalue.com/open/v1";
const API_KEY = process.env.SOSOVALUE_API_KEY ?? "";

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`SoSoValue API error ${res.status}: ${path}`);
  const json = await res.json();
  return json.data ?? json;
}

// Currencies
export const getCurrencies = () => get<CurrencyItem[]>("/currencies");
export const getCurrencySnapshot = (id: string) =>
  get<CurrencySnapshot>(`/currencies/${id}/market-snapshot`);
export const getCurrencyKlines = (id: string, interval: string, limit = 100) =>
  get<Kline[]>(`/currencies/${id}/klines`, { interval, limit });
export const getSectorSpotlight = () => get<SectorData>("/currencies/sector-spotlight");

// ETF
export const getETFSummaryHistory = (days = 30) =>
  get<ETFSummary[]>("/etfs/summary-history", { limit: days });
export const getETFList = () => get<ETFItem[]>("/etfs");
export const getETFSnapshot = (ticker: string) =>
  get<ETFSnapshot>(`/etfs/${ticker}/market-snapshot`);

// Indices
export const getIndexList = () => get<IndexItem[]>("/indices");
export const getIndexConstituents = (ticker: string) =>
  get<IndexConstituent[]>(`/indices/${ticker}/constituents`);
export const getIndexSnapshot = (ticker: string) =>
  get<IndexSnapshot>(`/indices/${ticker}/market-snapshot`);

// Crypto Stocks
export const getCryptoStocks = () => get<StockItem[]>("/crypto-stocks");
export const getStockSnapshot = (ticker: string) =>
  get<StockSnapshot>(`/crypto-stocks/${ticker}/market-snapshot`);
export const getStockSectors = () => get<StockSector[]>("/crypto-stocks/sector");

// BTC Treasuries
export const getBTCTreasuries = () => get<BTCTreasury[]>("/btc-treasuries");
export const getBTCPurchaseHistory = (ticker: string, limit = 20) =>
  get<BTCPurchase[]>(`/btc-treasuries/${ticker}/purchase-history`, { limit });

// News
export const getNewsFeed = (limit = 50, category?: string) =>
  get<NewsItem[]>("/news", { limit, ...(category ? { category } : {}) });
export const getHotNews = () => get<NewsItem[]>("/news/hot");
export const getFeaturedNews = () => get<NewsItem[]>("/news/featured");

// Fundraising
export const getFundraisingProjects = (limit = 50) =>
  get<FundraisingProject[]>("/fundraising/projects", { limit });
export const getFundraisingDetail = (id: string) =>
  get<FundraisingProjectDetail>(`/fundraising/projects/${id}`);

// Macro
export const getMacroEvents = (date?: string) =>
  get<MacroEvent[]>("/macro/events", date ? { date } : {});
export const getMacroEventHistory = (event: string, limit = 20) =>
  get<MacroEventHistory[]>(`/macro/events/${event}/history`, { limit });

// Analysis charts
export const getAnalysisCharts = () => get<AnalysisChart[]>("/analyses");
export const getChartData = (name: string) =>
  get<ChartData>(`/analyses/${name}`);

// Type stubs — actual shapes come from the API
export interface CurrencyItem { id: string; name: string; symbol: string; sector: string }
export interface CurrencySnapshot { price: number; change24h: number; volume24h: number; marketCap: number }
export interface Kline { time: number; open: number; high: number; low: number; close: number; volume: number }
export interface SectorData { sectors: Array<{ name: string; change24h: number; marketCap: number; tokens: string[] }> }
export interface ETFSummary { date: string; totalNetFlow: number; btcFlow: number; ethFlow: number; totalNetAsset: number }
export interface ETFItem { ticker: string; name: string; currency: string; totalNetAsset: number }
export interface ETFSnapshot { ticker: string; totalNetFlow: number; totalNetAsset: number; change: number }
export interface IndexItem { ticker: string; name: string; description: string }
export interface IndexConstituent { symbol: string; weight: number; price: number }
export interface IndexSnapshot { ticker: string; value: number; change24h: number }
export interface StockItem { ticker: string; name: string; sector: string; cryptoExposure: string }
export interface StockSnapshot { ticker: string; price: number; change: number; marketCap: number }
export interface StockSector { name: string; indexValue: number; change: number; companies: string[] }
export interface BTCTreasury { ticker: string; name: string; country: string; totalBTC: number; totalValue: number }
export interface BTCPurchase { date: string; amount: number; price: number; totalValue: number }
export interface NewsItem { newsId: string; title: string; summary: string; publishTime: string; categories: string[]; currencyCodes: string[] }
export interface FundraisingProject { id: string; name: string; sector: string; stage: string; amount: number; date: string; investors: string[] }
export interface FundraisingProjectDetail extends FundraisingProject { description: string; website: string }
export interface MacroEvent { event: string; date: string; actual?: number; forecast?: number; previous?: number; impact: "HIGH" | "MEDIUM" | "LOW" }
export interface MacroEventHistory { date: string; actual: number; forecast: number; btcChange24h: number; cryptoMarketChange: number }
export interface AnalysisChart { name: string; title: string; description: string }
export interface ChartData { name: string; data: Array<{ time: string; value: number }> }
