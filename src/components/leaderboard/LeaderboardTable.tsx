"use client";

import { LeaderboardEntry } from "@/types";
import Link from "next/link";
import { useEffect, useState } from "react";

const STYLE_LABELS: Record<string, { emoji: string; name: string }> = {
  "yolo-king": { emoji: "\uD83D\uDD25", name: "梭哈之王" },
  "zen-monk": { emoji: "\uD83E\uDDD8", name: "定投老僧" },
  "news-hawk": { emoji: "\uD83D\uDCE1", name: "消息面大师" },
  "contrarian": { emoji: "\uD83D\uDD04", name: "反向指标" },
};

function formatMoney(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LeaderboardTable() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/leaderboard");
        const json = await res.json();
        if (json.code === 0) setEntries(json.data);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return <div className="text-gray-500 text-center py-12">加载排行榜...</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="text-gray-500 text-center py-12">
        暂无参赛者，快来登录参与吧！
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800">
            <th className="text-left py-3 px-2">排名</th>
            <th className="text-left py-3 px-2">AI 交易员</th>
            <th className="text-right py-3 px-2">总资产</th>
            <th className="text-right py-3 px-2">盈亏</th>
            <th className="text-right py-3 px-2">收益率</th>
            <th className="text-right py-3 px-2">持仓数</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.userId} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              <td className="py-3 px-2">
                <span className={`font-bold ${
                  entry.rank === 1 ? "text-yellow-400" :
                  entry.rank === 2 ? "text-gray-300" :
                  entry.rank === 3 ? "text-amber-600" : "text-gray-500"
                }`}>
                  #{entry.rank}
                </span>
              </td>
              <td className="py-3 px-2">
                <Link href={`/trader/${entry.userId}`} className="flex items-center gap-2 hover:text-emerald-400 transition-colors">
                  {entry.avatar ? (
                    <img src={entry.avatar} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-700" />
                  )}
                  <span className="font-medium">{entry.name}</span>
                  {entry.isLiquidated && (
                    <span className="text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">
                      已爆仓
                    </span>
                  )}
                  {!entry.isLiquidated && entry.tradingStyle && STYLE_LABELS[entry.tradingStyle] && (
                    <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                      {STYLE_LABELS[entry.tradingStyle].emoji} {STYLE_LABELS[entry.tradingStyle].name}
                    </span>
                  )}
                </Link>
              </td>
              <td className="py-3 px-2 text-right font-mono">${formatMoney(entry.totalAssets)}</td>
              <td className={`py-3 px-2 text-right font-mono ${(entry.profitLoss ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {(entry.profitLoss ?? 0) >= 0 ? "+" : ""}${formatMoney(entry.profitLoss)}
              </td>
              <td className={`py-3 px-2 text-right font-mono ${(entry.profitLossPercent ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {(entry.profitLossPercent ?? 0) >= 0 ? "+" : ""}{(entry.profitLossPercent ?? 0).toFixed(2)}%
              </td>
              <td className="py-3 px-2 text-right text-gray-400">{entry.holdingsCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
