import { CoinTicker } from "@/types";

const BASE_URL = process.env.BINANCE_API_BASE || "https://data-api.binance.vision";

const TOP_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
  "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT",
];

interface BinanceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export async function getTopCoins(): Promise<CoinTicker[]> {
  const symbols = JSON.stringify(TOP_SYMBOLS);
  const url = `${BASE_URL}/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbols)}`;

  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);

  const data: BinanceTicker[] = await res.json();

  return data
    .map((t) => ({
      symbol: t.symbol,
      name: t.symbol.replace("USDT", ""),
      price: parseFloat(t.lastPrice),
      priceChange: parseFloat(t.priceChange),
      priceChangePercent: parseFloat(t.priceChangePercent),
      high24h: parseFloat(t.highPrice),
      low24h: parseFloat(t.lowPrice),
      volume: parseFloat(t.volume),
      quoteVolume: parseFloat(t.quoteVolume),
    }))
    .sort((a, b) => b.quoteVolume - a.quoteVolume);
}

export async function getCoinPrice(symbol: string): Promise<number> {
  const url = `${BASE_URL}/api/v3/ticker/price?symbol=${symbol}`;
  const res = await fetch(url, { next: { revalidate: 10 } });
  if (!res.ok) throw new Error(`Binance price error: ${res.status}`);
  const data = await res.json();
  return parseFloat(data.price);
}

export async function getCoinPrices(
  symbols: string[]
): Promise<Record<string, number>> {
  const symbolsParam = JSON.stringify(symbols);
  const url = `${BASE_URL}/api/v3/ticker/price?symbols=${encodeURIComponent(symbolsParam)}`;
  const res = await fetch(url, { next: { revalidate: 10 } });
  if (!res.ok) throw new Error(`Binance prices error: ${res.status}`);
  const data: { symbol: string; price: string }[] = await res.json();

  const prices: Record<string, number> = {};
  for (const item of data) {
    prices[item.symbol] = parseFloat(item.price);
  }
  return prices;
}

// K 线数据 (最近 24 根 1 小时 K 线)
export async function getKlines(symbol: string): Promise<number[]> {
  const url = `${BASE_URL}/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Binance klines error: ${res.status}`);
  const data: unknown[][] = await res.json();
  // 每根 K 线的第 4 个字段是收盘价
  return data.map((k) => parseFloat(k[4] as string));
}

// 批量获取所有币种 K 线
export async function getAllKlines(
  symbols: string[]
): Promise<Record<string, number[]>> {
  const results = await Promise.allSettled(
    symbols.map(async (s) => ({ symbol: s, data: await getKlines(s) }))
  );
  const klines: Record<string, number[]> = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      klines[r.value.symbol] = r.value.data;
    }
  }
  return klines;
}
