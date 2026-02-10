import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";
import { calcLeveragedValue } from "@/lib/leverage";
import { HoldingInfo } from "@/types";
import PortfolioChart from "@/components/trader/PortfolioChart";
import TradeHistory from "@/components/trader/TradeHistory";
import EquityCurve from "@/components/trader/EquityCurve";
import AiMonologue from "@/components/trader/AiMonologue";
import AutoRefresh from "@/components/common/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      portfolio: { include: { holdings: true } },
      trades: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!user || !user.portfolio) redirect("/login");

  const symbols = user.portfolio.holdings.map((h) => h.symbol);
  const prices = symbols.length > 0 ? await getCoinPrices(symbols) : {};

  const isLiquidated = !!user.portfolio.liquidatedAt;

  const holdings: HoldingInfo[] = user.portfolio.holdings.map((h) => {
    const currentPrice = prices[h.symbol] || 0;
    const marketValue = calcLeveragedValue(h.quantity, h.avgCost, currentPrice, h.leverage);
    const costValue = h.quantity * h.avgCost;
    return {
      symbol: h.symbol,
      quantity: h.quantity,
      avgCost: h.avgCost,
      currentPrice,
      marketValue,
      profitLoss: marketValue - costValue,
      profitLossPercent: costValue > 0 ? ((marketValue - costValue) / costValue) * 100 : 0,
      leverage: h.leverage,
    };
  });

  const holdingsValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalAssets = isLiquidated ? 0 : user.portfolio.cashBalance + holdingsValue;
  const profitLoss = totalAssets - 100000;

  // 取最新一条有独白的交易
  const latestWithMonologue = user.trades.find((t) => t.monologue);

  const trades = user.trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side as "BUY" | "SELL",
    quantity: t.quantity,
    price: t.price,
    total: t.total,
    leverage: t.leverage,
    reason: t.reason,
    monologue: t.monologue,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div>
      <AutoRefresh interval={30000} />
      <h1 className="text-2xl font-bold mb-6">
        {user.name} 的 AI 交易面板
      </h1>

      {isLiquidated && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-4 text-center">
          <p className="text-red-400 font-bold text-lg">已爆仓</p>
          <p className="text-red-400/70 text-sm mt-1">你的 AI 交易员因杠杆亏损过大，总资产已归零</p>
        </div>
      )}

      <AiMonologue
        tradingStyle={user.tradingStyle}
        customPersona={user.customPersona}
        monologue={latestWithMonologue?.monologue || null}
        monologueTime={latestWithMonologue?.createdAt.toISOString() || null}
        editable
      />

      <div className="mt-6">
        <EquityCurve userId={session.userId} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-4">持仓概览</h2>
          <PortfolioChart
            cashBalance={user.portfolio.cashBalance}
            holdings={holdings}
            totalAssets={totalAssets}
            profitLoss={profitLoss}
          />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-4">最近交易</h2>
          <TradeHistory trades={trades} />
        </div>
      </div>
    </div>
  );
}
