"use client";

import { TradeRecord } from "@/types";

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  trades: TradeRecord[];
}

export default function TradeHistory({ trades }: Props) {
  if (trades.length === 0) {
    return <p className="text-gray-500 text-center text-sm py-8">暂无交易记录</p>;
  }

  return (
    <div className="space-y-3">
      {trades.map((trade) => (
        <div key={trade.id} className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                trade.side === "BUY"
                  ? "bg-emerald-900/50 text-emerald-400"
                  : "bg-red-900/50 text-red-400"
              }`}>
                {trade.side === "BUY" ? "买入" : "卖出"}
              </span>
              <span className="font-medium">{trade.symbol.replace("USDT", "")}</span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(trade.createdAt).toLocaleString("zh-CN")}
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>数量: {trade.quantity.toFixed(6)} | 价格: ${formatMoney(trade.price)}</span>
            <span className="font-mono">${formatMoney(trade.total)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {trade.reason}
          </p>
          {trade.monologue && (
            <p className="text-xs text-gray-400 italic mt-1">
              &ldquo;{trade.monologue}&rdquo;
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
