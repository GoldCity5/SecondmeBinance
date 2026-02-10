"use client";

import { useState } from "react";
import { HoldingInfo, TradeRecord } from "@/types";
import PortfolioChart from "@/components/trader/PortfolioChart";
import TradeHistory from "@/components/trader/TradeHistory";
import EquityCurve from "@/components/trader/EquityCurve";
import AiMonologue from "@/components/trader/AiMonologue";
import ManualPanel from "./ManualPanel";

type TabType = "ai" | "manual";

interface AiData {
  tradingStyle: string;
  customPersona: string;
  monologues: { symbol: string; side: string; monologue: string }[];
  monologueTime: string | null;
  cashBalance: number;
  holdings: HoldingInfo[];
  totalAssets: number;
  profitLoss: number;
  isLiquidated: boolean;
  trades: TradeRecord[];
}

interface ManualData {
  exists: boolean;
  cashBalance: number;
  holdings: HoldingInfo[];
  totalAssets: number;
  profitLoss: number;
  isLiquidated: boolean;
  trades: TradeRecord[];
}

interface Props {
  userId: string;
  aiData: AiData;
  manualData: ManualData;
}

export default function DashboardTabs({ userId, aiData, manualData }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("ai");

  return (
    <div>
      {/* Tab 切换 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("ai")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === "ai"
              ? "bg-cyan-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          AI 交易员
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === "manual"
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          真人交易
        </button>
      </div>

      {activeTab === "ai" ? (
        <AiTab userId={userId} data={aiData} />
      ) : (
        <ManualTab userId={userId} data={manualData} />
      )}
    </div>
  );
}

function AiTab({ userId, data }: { userId: string; data: AiData }) {
  return (
    <>
      {data.isLiquidated && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-4 text-center">
          <p className="text-red-400 font-bold text-lg">已爆仓</p>
          <p className="text-red-400/70 text-sm mt-1">你的 AI 交易员因杠杆亏损过大，总资产已归零</p>
        </div>
      )}

      <AiMonologue
        tradingStyle={data.tradingStyle}
        customPersona={data.customPersona}
        monologues={data.monologues}
        monologueTime={data.monologueTime}
        editable
      />

      <div className="mt-6">
        <EquityCurve userId={userId} type="AI" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-4">持仓概览</h2>
          <PortfolioChart
            cashBalance={data.cashBalance}
            holdings={data.holdings}
            totalAssets={data.totalAssets}
            profitLoss={data.profitLoss}
          />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-4">最近交易</h2>
          <TradeHistory trades={data.trades} />
        </div>
      </div>
    </>
  );
}

function ManualTab({ userId, data }: { userId: string; data: ManualData }) {
  if (!data.exists) {
    return <ManualActivation />;
  }

  return (
    <ManualPanel
      userId={userId}
      cashBalance={data.cashBalance}
      holdings={data.holdings}
      totalAssets={data.totalAssets}
      profitLoss={data.profitLoss}
      isLiquidated={data.isLiquidated}
      trades={data.trades}
    />
  );
}

function ManualActivation() {
  const [loading, setLoading] = useState(false);

  async function handleActivate() {
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio/manual", { method: "POST" });
      const json = await res.json();
      if (json.code === 0) {
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
      <h3 className="text-lg font-semibold mb-2">开启真人交易</h3>
      <p className="text-gray-400 text-sm mb-6">
        开启后，你将获得独立的 10 万 USDT 虚拟资金，可以亲自下场交易，与 AI 交易员独立运作。
      </p>
      <button
        onClick={handleActivate}
        disabled={loading}
        className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg font-medium transition"
      >
        {loading ? "开启中..." : "开启真人交易账户"}
      </button>
    </div>
  );
}
