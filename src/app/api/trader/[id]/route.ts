import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";
import { calcLeveragedValue } from "@/lib/leverage";
import { PortfolioType } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const type = (request.nextUrl.searchParams.get("type")?.toUpperCase() || "AI") as PortfolioType;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ code: 404, message: "用户不存在" }, { status: 404 });
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { userId_type: { userId: id, type } },
      include: { holdings: true },
    });

    if (!portfolio) {
      return NextResponse.json({ code: 404, message: "投资组合不存在" }, { status: 404 });
    }

    const trades = await prisma.trade.findMany({
      where: { portfolioId: portfolio.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const symbols = [...new Set(portfolio.holdings.map((h) => h.symbol))];
    const prices = symbols.length > 0 ? await getCoinPrices(symbols) : {};

    const isLiquidated = !!portfolio.liquidatedAt;

    const holdings = portfolio.holdings.map((h) => {
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
    const cashBalance = portfolio.cashBalance;
    const totalAssets = isLiquidated ? 0 : cashBalance + holdingsValue;

    return NextResponse.json({
      code: 0,
      data: {
        name: user.name,
        avatar: user.avatar,
        tradingStyle: type === "AI" ? (user.tradingStyle || "") : "",
        type,
        isLiquidated,
        cashBalance,
        totalAssets,
        profitLoss: totalAssets - (Number(process.env.INITIAL_FUND) || 100000),
        holdings,
        trades: trades.map((t) => ({
          id: t.id,
          symbol: t.symbol,
          side: t.side,
          quantity: t.quantity,
          price: t.price,
          total: t.total,
          leverage: t.leverage,
          reason: t.reason,
          monologue: t.monologue,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("Trader API error:", err);
    return NextResponse.json({ code: 500, message: "获取数据失败" }, { status: 500 });
  }
}
