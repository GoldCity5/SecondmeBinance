"use client";

import { CoinTicker } from "@/types";
import { useEffect, useState } from "react";
import Sparkline from "./Sparkline";

function formatPrice(price: number): string {
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toPrecision(4);
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
  return vol.toLocaleString();
}

export default function PriceTable() {
  const [coins, setCoins] = useState<CoinTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/market");
        const json = await res.json();
        if (json.code === 0) {
          setCoins(json.data);
          setError(null);
        } else {
          setError(json.message || "获取行情失败");
        }
      } catch {
        setError("网络请求失败，请检查网络连接");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return <div className="text-gray-500 text-center py-12">加载行情数据...</div>;
  }

  if (error) {
    return <div className="text-red-400 text-center py-12">{error}</div>;
  }

  if (coins.length === 0) {
    return <div className="text-gray-500 text-center py-12">暂无行情数据</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800">
            <th className="text-left py-3 px-2">#</th>
            <th className="text-left py-3 px-2">币种</th>
            <th className="text-right py-3 px-2">价格 (USDT)</th>
            <th className="text-right py-3 px-2">24h 涨跌</th>
            <th className="text-center py-3 px-2">24h K线</th>
            <th className="text-right py-3 px-2">24h 最高</th>
            <th className="text-right py-3 px-2">24h 最低</th>
            <th className="text-right py-3 px-2">24h 交易额</th>
          </tr>
        </thead>
        <tbody>
          {coins.map((coin, i) => (
            <tr key={coin.symbol} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              <td className="py-3 px-2 text-gray-500">{i + 1}</td>
              <td className="py-3 px-2 font-medium text-white">{coin.name}</td>
              <td className="py-3 px-2 text-right font-mono">${formatPrice(coin.price)}</td>
              <td className={`py-3 px-2 text-right font-mono ${coin.priceChangePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {coin.priceChangePercent >= 0 ? "+" : ""}{coin.priceChangePercent.toFixed(2)}%
              </td>
              <td className="py-3 px-2 text-center">
                <Sparkline
                  data={coin.kline || []}
                  positive={coin.priceChangePercent >= 0}
                />
              </td>
              <td className="py-3 px-2 text-right font-mono text-gray-400">${formatPrice(coin.high24h)}</td>
              <td className="py-3 px-2 text-right font-mono text-gray-400">${formatPrice(coin.low24h)}</td>
              <td className="py-3 px-2 text-right font-mono text-gray-400">${formatVolume(coin.quoteVolume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
