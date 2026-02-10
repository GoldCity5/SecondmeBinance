"use client";

import { HoldingInfo } from "@/types";

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  cashBalance: number;
  holdings: HoldingInfo[];
  totalAssets: number;
  profitLoss: number;
}

export default function PortfolioChart({ cashBalance, holdings, totalAssets, profitLoss }: Props) {
  const profitLossPercent = (profitLoss / 100000) * 100;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-gray-500 text-xs mb-1">总资产</p>
          <p className="text-xl font-bold font-mono">${formatMoney(totalAssets)}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-gray-500 text-xs mb-1">盈亏</p>
          <p className={`text-xl font-bold font-mono ${profitLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {profitLoss >= 0 ? "+" : ""}${formatMoney(profitLoss)}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-gray-500 text-xs mb-1">收益率</p>
          <p className={`text-xl font-bold font-mono ${profitLossPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {profitLossPercent >= 0 ? "+" : ""}{profitLossPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center text-sm px-1">
        <span className="text-gray-400">可用现金</span>
        <span className="font-mono">${formatMoney(cashBalance)}</span>
      </div>

      {holdings.length > 0 ? (
        <div className="space-y-2">
          {holdings.map((h) => (
            <div key={h.symbol} className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{h.symbol.replace("USDT", "")}</p>
                <p className="text-xs text-gray-500">
                  {h.quantity.toFixed(6)} 个 | 均价 ${formatMoney(h.avgCost)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono">${formatMoney(h.marketValue)}</p>
                <p className={`text-xs font-mono ${h.profitLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {h.profitLoss >= 0 ? "+" : ""}{h.profitLossPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center text-sm py-4">暂无持仓，等待 AI 下一次交易决策</p>
      )}
    </div>
  );
}
