import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";
import { calcLeveragedValue } from "@/lib/leverage";
import { HoldingInfo, TradeRecord } from "@/types";
import DashboardTabs from "@/components/dashboard/DashboardTabs";
import AutoRefresh from "@/components/common/AutoRefresh";

export const dynamic = "force-dynamic";

function buildHoldings(
  rawHoldings: { symbol: string; quantity: number; avgCost: number; leverage: number }[],
  prices: Record<string, number>
): HoldingInfo[] {
  return rawHoldings.map((h) => {
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
}

function buildTrades(
  rawTrades: { id: string; symbol: string; side: string; quantity: number; price: number; total: number; leverage: number; reason: string; monologue: string; createdAt: Date }[]
): TradeRecord[] {
  return rawTrades.map((t) => ({
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
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      portfolios: {
        include: { holdings: true, trades: { orderBy: { createdAt: "desc" }, take: 50 } },
      },
    },
  });

  if (!user) redirect("/login");

  const aiPortfolio = user.portfolios.find((p) => p.type === "AI");
  const manualPortfolio = user.portfolios.find((p) => p.type === "MANUAL");

  if (!aiPortfolio) redirect("/login");

  // 收集所有持仓的 symbol
  const allSymbols = new Set<string>();
  for (const p of user.portfolios) {
    for (const h of p.holdings) allSymbols.add(h.symbol);
  }
  const prices = allSymbols.size > 0 ? await getCoinPrices([...allSymbols]) : {};

  // AI 数据
  const aiHoldings = buildHoldings(aiPortfolio.holdings, prices);
  const aiHoldingsValue = aiHoldings.reduce((sum, h) => sum + h.marketValue, 0);
  const aiTotalAssets = aiPortfolio.liquidatedAt ? 0 : aiPortfolio.cashBalance + aiHoldingsValue;

  const latestWithMonologue = aiPortfolio.trades.find((t) => t.monologue);
  const latestBatchMonologues = (() => {
    if (!latestWithMonologue) return [];
    const batchTime = latestWithMonologue.createdAt.getTime();
    return aiPortfolio.trades
      .filter((t) => t.monologue && Math.abs(t.createdAt.getTime() - batchTime) < 60000)
      .reverse()
      .map((t) => ({ symbol: t.symbol, side: t.side, monologue: t.monologue }));
  })();

  // 真人数据
  const manualHoldings = manualPortfolio ? buildHoldings(manualPortfolio.holdings, prices) : [];
  const manualHoldingsValue = manualHoldings.reduce((sum, h) => sum + h.marketValue, 0);
  const manualTotalAssets = manualPortfolio
    ? (manualPortfolio.liquidatedAt ? 0 : manualPortfolio.cashBalance + manualHoldingsValue)
    : 0;

  return (
    <div>
      <AutoRefresh interval={30000} />
      <h1 className="text-2xl font-bold mb-6">
        {user.name} 的交易面板
      </h1>

      <DashboardTabs
        userId={session.userId}
        aiData={{
          tradingStyle: user.tradingStyle,
          customPersona: user.customPersona,
          monologues: latestBatchMonologues,
          monologueTime: latestWithMonologue?.createdAt.toISOString() || null,
          cashBalance: aiPortfolio.cashBalance,
          holdings: aiHoldings,
          totalAssets: aiTotalAssets,
          profitLoss: aiTotalAssets - (Number(process.env.INITIAL_FUND) || 100000),
          isLiquidated: !!aiPortfolio.liquidatedAt,
          trades: buildTrades(aiPortfolio.trades),
        }}
        manualData={{
          exists: !!manualPortfolio,
          cashBalance: manualPortfolio?.cashBalance || 0,
          holdings: manualHoldings,
          totalAssets: manualTotalAssets,
          profitLoss: manualTotalAssets - (Number(process.env.INITIAL_FUND) || 100000),
          isLiquidated: !!manualPortfolio?.liquidatedAt,
          trades: manualPortfolio ? buildTrades(manualPortfolio.trades) : [],
        }}
      />
    </div>
  );
}
