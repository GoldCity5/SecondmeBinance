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

type TabType = "ai" | "manual" | "all";
const TABS: { label: string; value: TabType }[] = [
  { label: "全部", value: "all" },
  { label: "AI 交易员", value: "ai" },
  { label: "真人交易", value: "manual" },
];

function formatMoney(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LeaderboardTable() {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch(`/api/leaderboard?type=${activeTab}`);
        const json = await res.json();
        if (!cancelled && json.code === 0) setEntries(json.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [activeTab]);

  return (
    <div>
      {/* Tab 切换 */}
      <div className="flex gap-2 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.value
                ? "bg-cyan-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-12">加载排行榜...</div>
      ) : entries.length === 0 ? (
        <div className="text-gray-500 text-center py-12">
          暂无参赛者，快来登录参与吧！
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => {
            // "全部"视图：真人排名低于自己的 AI 排名时，标记"不如AI"
            let worseThanAi = false;
            if (activeTab === "all" && entry.type === "MANUAL") {
              const aiEntry = entries.find((e) => e.userId === entry.userId && e.type === "AI");
              if (aiEntry && entry.rank > aiEntry.rank) {
                worseThanAi = true;
              }
            }
            return (
              <LeaderboardCard
                key={`${entry.userId}-${entry.type}-${idx}`}
                entry={entry}
                showTypeTag={activeTab === "all"}
                worseThanAi={worseThanAi}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function LeaderboardCard({ entry, showTypeTag, worseThanAi }: { entry: LeaderboardEntry; showTypeTag: boolean; worseThanAi: boolean }) {
  const style = STYLE_LABELS[entry.tradingStyle];
  const plPercent = entry.profitLossPercent ?? 0;
  const plColor = plPercent >= 0 ? "text-emerald-400" : "text-red-400";
  const typeParam = entry.type === "MANUAL" ? "?type=MANUAL" : "";

  return (
    <Link href={`/trader/${entry.userId}${typeParam}`} className="block">
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
                {showTypeTag && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    entry.type === "AI"
                      ? "bg-blue-900/40 text-blue-400"
                      : "bg-purple-900/40 text-purple-400"
                  }`}>
                    {entry.type === "AI" ? "AI" : "真人"}
                  </span>
                )}
                {worseThanAi && (
                  <span className="text-xs bg-orange-900/40 text-orange-400 px-1.5 py-0.5 rounded">
                    不如AI
                  </span>
                )}
                {entry.isLiquidated && (
                  <span className="text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">已爆仓</span>
                )}
                {entry.type === "AI" && !entry.isLiquidated && entry.customPersona ? (
                  <span className="text-xs bg-cyan-900/40 text-cyan-400 px-1.5 py-0.5 rounded">
                    {"\uD83C\uDFAD"} 自定义人设
                  </span>
                ) : entry.type === "AI" && !entry.isLiquidated && style && (
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

        {/* 底部：最新独白（仅 AI） */}
        {entry.type === "AI" && entry.latestMonologue && (
          <p className="text-xs text-gray-500 italic mt-2 ml-11 truncate">
            &ldquo;{entry.latestMonologue}&rdquo;
          </p>
        )}
      </div>
    </Link>
  );
}
