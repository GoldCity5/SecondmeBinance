import { CoinTicker } from "@/types";

const BASE_URL = process.env.BINANCE_API_BASE || "https://api.binance.com";

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
