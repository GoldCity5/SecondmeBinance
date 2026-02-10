import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";
import { HoldingInfo } from "@/types";
import PortfolioChart from "@/components/trader/PortfolioChart";
import TradeHistory from "@/components/trader/TradeHistory";
import EquityCurve from "@/components/trader/EquityCurve";
import AiMonologue from "@/components/trader/AiMonologue";
import AutoRefresh from "@/components/common/AutoRefresh";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TraderPage({ params }: Props) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      portfolio: { include: { holdings: true } },
      trades: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });

  if (!user || !user.portfolio) notFound();

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
      <div className="flex items-center gap-3 mb-6">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-700" />
        )}
        <h1 className="text-2xl font-bold">{user.name} 的 AI 交易员</h1>
      </div>

      <AiMonologue
        tradingStyle={user.tradingStyle}
        customPersona={user.customPersona}
        monologue={latestWithMonologue?.monologue || null}
        monologueTime={latestWithMonologue?.createdAt.toISOString() || null}
      />

      <div className="mt-6">
        <EquityCurve userId={id} />
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
          <h2 className="text-lg font-semibold mb-4">交易记录</h2>
          <TradeHistory trades={trades} />
        </div>
      </div>
    </div>
  );
}
