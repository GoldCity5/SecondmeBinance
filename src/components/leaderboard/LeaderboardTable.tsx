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
    <div className="space-y-3">
      {entries.map((entry) => (
        <LeaderboardCard key={entry.userId} entry={entry} />
      ))}
    </div>
  );
}

function LeaderboardCard({ entry }: { entry: LeaderboardEntry }) {
  const style = STYLE_LABELS[entry.tradingStyle];
  const plPercent = entry.profitLossPercent ?? 0;
  const plColor = plPercent >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <Link href={`/trader/${entry.userId}`} className="block">
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors">
        {/* 顶部：排名 + 用户信息 + 资产 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-lg font-bold w-8 ${
              entry.rank === 1 ? "text-yellow-400" :
              entry.rank === 2 ? "text-gray-300" :
              entry.rank === 3 ? "text-amber-600" : "text-gray-500"
            }`}>
              #{entry.rank}
            </span>
            {entry.avatar ? (
              <img src={entry.avatar} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-700" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{entry.name}</span>
                {entry.isLiquidated && (
                  <span className="text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">已爆仓</span>
                )}
                {!entry.isLiquidated && style && (
                  <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                    {style.emoji} {style.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono font-semibold">${formatMoney(entry.totalAssets)}</p>
            <p className={`text-xs font-mono ${plColor}`}>
              {plPercent >= 0 ? "+" : ""}{plPercent.toFixed(2)}%
              {" "}({(entry.profitLoss ?? 0) >= 0 ? "+" : ""}${formatMoney(entry.profitLoss)})
            </p>
          </div>
        </div>

        {/* 中间：持仓币种标签 */}
        {entry.holdings.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 ml-11">
            {entry.holdings.map((h, i) => {
              const hColor = h.profitLossPercent >= 0 ? "text-emerald-400" : "text-red-400";
              return (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-800/80 px-2 py-1 rounded">
                  <span className="text-gray-200">{h.symbol.replace("USDT", "")}</span>
                  {h.leverage > 1 && (
                    <span className="text-amber-400 font-bold">{h.leverage}x</span>
                  )}
                  <span className={`font-mono ${hColor}`}>
                    {h.profitLossPercent >= 0 ? "+" : ""}{h.profitLossPercent.toFixed(1)}%
                  </span>
                </span>
              );
            })}
          </div>
        )}

        {/* 底部：最新独白 */}
        {entry.latestMonologue && (
          <p className="text-xs text-gray-500 italic mt-2 ml-11 truncate">
            &ldquo;{entry.latestMonologue}&rdquo;
          </p>
        )}
      </div>
    </Link>
  );
}
