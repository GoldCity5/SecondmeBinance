import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";
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

  const holdings: HoldingInfo[] = user.portfolio.holdings.map((h) => {
    const currentPrice = prices[h.symbol] || 0;
    const marketValue = h.quantity * currentPrice;
    const costValue = h.quantity * h.avgCost;
    return {
      symbol: h.symbol,
      quantity: h.quantity,
      avgCost: h.avgCost,
      currentPrice,
      marketValue,
      profitLoss: marketValue - costValue,
      profitLossPercent: costValue > 0 ? ((marketValue - costValue) / costValue) * 100 : 0,
    };
  });

  const holdingsValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalAssets = user.portfolio.cashBalance + holdingsValue;
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
