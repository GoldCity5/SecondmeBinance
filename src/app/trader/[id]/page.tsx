import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";
import { calcLeveragedValue } from "@/lib/leverage";
import { HoldingInfo, PortfolioType } from "@/types";
import PortfolioChart from "@/components/trader/PortfolioChart";
import TradeHistory from "@/components/trader/TradeHistory";
import EquityCurve from "@/components/trader/EquityCurve";
import AiMonologue from "@/components/trader/AiMonologue";
import AutoRefresh from "@/components/common/AutoRefresh";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function TraderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const type = (sp.type?.toUpperCase() || "AI") as PortfolioType;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId_type: { userId: id, type } },
    include: { holdings: true },
  });
  if (!portfolio) notFound();

  const trades = await prisma.trade.findMany({
    where: { portfolioId: portfolio.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const symbols = [...new Set(portfolio.holdings.map((h) => h.symbol))];
  const prices = symbols.length > 0 ? await getCoinPrices(symbols) : {};

  const isLiquidated = !!portfolio.liquidatedAt;

  const holdings: HoldingInfo[] = portfolio.holdings.map((h) => {
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
  const totalAssets = isLiquidated ? 0 : portfolio.cashBalance + holdingsValue;
  const profitLoss = totalAssets - (Number(process.env.INITIAL_FUND) || 100000);

  const isAi = type === "AI";
  const title = isAi ? `${user.name} 的 AI 交易员` : `${user.name} 的真人交易`;

  // AI 独白（仅 AI 类型显示）
  const latestWithMonologue = isAi ? trades.find((t) => t.monologue) : null;
  const latestBatchMonologues = (() => {
    if (!latestWithMonologue) return [];
    const batchTime = latestWithMonologue.createdAt.getTime();
    return trades
      .filter((t) => t.monologue && Math.abs(t.createdAt.getTime() - batchTime) < 60000)
      .reverse()
      .map((t) => ({ symbol: t.symbol, side: t.side, monologue: t.monologue }));
  })();

  const tradeRecords = trades.map((t) => ({
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
      <div className="flex items-center gap-3 mb-6">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-700" />
        )}
        <h1 className="text-2xl font-bold">{title}</h1>
        <span className={`text-xs px-2 py-1 rounded ${
          isAi ? "bg-blue-900/40 text-blue-400" : "bg-purple-900/40 text-purple-400"
        }`}>
          {isAi ? "AI" : "真人"}
        </span>
      </div>

      {isLiquidated && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-4 text-center">
          <p className="text-red-400 font-bold text-lg">已爆仓</p>
          <p className="text-red-400/70 text-sm mt-1">
            {isAi ? "该 AI 交易员" : "该真人交易账户"}因杠杆亏损过大，总资产已归零
          </p>
        </div>
      )}

      {isAi && (
        <AiMonologue
          tradingStyle={user.tradingStyle}
          customPersona={user.customPersona}
          monologues={latestBatchMonologues}
          monologueTime={latestWithMonologue?.createdAt.toISOString() || null}
        />
      )}

      <div className="mt-6">
        <EquityCurve userId={id} type={type} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-4">持仓概览</h2>
          <PortfolioChart
            cashBalance={portfolio.cashBalance}
            holdings={holdings}
            totalAssets={totalAssets}
            profitLoss={profitLoss}
          />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-4">交易记录</h2>
          <TradeHistory trades={tradeRecords} />
        </div>
      </div>
    </div>
  );
}
