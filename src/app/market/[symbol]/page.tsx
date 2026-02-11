import Link from "next/link";
import { get24hTicker } from "@/lib/binance";
import KlineChart from "@/components/market/KlineChart";
import AutoRefresh from "@/components/common/AutoRefresh";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ symbol: string }>;
}

function formatPrice(price: number): string {
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toPrecision(4);
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
  return vol.toLocaleString();
}

export default async function CoinDetailPage({ params }: Props) {
  const { symbol } = await params;

  let ticker;
  try {
    ticker = await get24hTicker(symbol);
  } catch {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">无法获取 {symbol} 的行情数据</p>
        <Link href="/market" className="text-cyan-400 hover:underline">返回行情页</Link>
      </div>
    );
  }

  const plColor = ticker.priceChangePercent >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div>
      <AutoRefresh interval={30000} />

      {/* 顶部导航 + 价格 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/market" className="text-gray-400 hover:text-white transition text-sm">
          &larr; 行情
        </Link>
        <h1 className="text-2xl font-bold">{ticker.name}</h1>
        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">{symbol}</span>
      </div>

      <div className="flex items-baseline gap-4 mb-6">
        <span className="text-3xl font-bold font-mono">${formatPrice(ticker.price)}</span>
        <span className={`text-lg font-mono ${plColor}`}>
          {ticker.priceChangePercent >= 0 ? "+" : ""}{ticker.priceChangePercent.toFixed(2)}%
        </span>
        <span className={`text-sm font-mono ${plColor}`}>
          {ticker.priceChange >= 0 ? "+" : ""}${formatPrice(Math.abs(ticker.priceChange))}
        </span>
      </div>

      {/* K 线图 */}
      <KlineChart symbol={symbol} />

      {/* 24h 统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <StatCard label="24h 最高" value={`$${formatPrice(ticker.high24h)}`} />
        <StatCard label="24h 最低" value={`$${formatPrice(ticker.low24h)}`} />
        <StatCard label="24h 交易量" value={`${formatVolume(ticker.volume)} ${ticker.name}`} />
        <StatCard label="24h 交易额" value={`$${formatVolume(ticker.quoteVolume)}`} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className="font-mono font-semibold">{value}</p>
    </div>
  );
}
