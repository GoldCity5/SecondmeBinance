"use client";

import { HoldingInfo, TradeRecord } from "@/types";
import PortfolioChart from "@/components/trader/PortfolioChart";
import TradeHistory from "@/components/trader/TradeHistory";
import EquityCurve from "@/components/trader/EquityCurve";
import TradeForm from "./TradeForm";

interface Props {
  userId: string;
  cashBalance: number;
  holdings: HoldingInfo[];
  totalAssets: number;
  profitLoss: number;
  isLiquidated: boolean;
  trades: TradeRecord[];
}

export default function ManualPanel({
  userId,
  cashBalance,
  holdings,
  totalAssets,
  profitLoss,
  isLiquidated,
  trades,
}: Props) {
  return (
    <>
      {isLiquidated && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-4 text-center">
          <p className="text-red-400 font-bold text-lg">已爆仓</p>
          <p className="text-red-400/70 text-sm mt-1">你的真人交易账户因杠杆亏损过大，总资产已归零</p>
        </div>
      )}

      <div className="mt-6">
        <EquityCurve userId={userId} type="MANUAL" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-4">持仓概览</h2>
          <PortfolioChart
            cashBalance={cashBalance}
            holdings={holdings}
            totalAssets={totalAssets}
            profitLoss={profitLoss}
          />
        </div>

        {!isLiquidated && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-4">下单交易</h2>
            <TradeForm />
          </div>
        )}
      </div>

      <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-4">交易记录</h2>
        <TradeHistory trades={trades} />
      </div>
    </>
  );
}
