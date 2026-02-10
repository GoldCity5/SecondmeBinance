import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        portfolio: { include: { holdings: true } },
        trades: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });

    if (!user) {
      return NextResponse.json({ code: 404, message: "用户不存在" }, { status: 404 });
    }

    const symbols = user.portfolio?.holdings.map((h) => h.symbol) || [];
    const prices = symbols.length > 0 ? await getCoinPrices(symbols) : {};

    const holdings = (user.portfolio?.holdings || []).map((h) => {
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
    const cashBalance = user.portfolio?.cashBalance || 0;

    return NextResponse.json({
      code: 0,
      data: {
        name: user.name,
        avatar: user.avatar,
        tradingStyle: user.tradingStyle || "",
        cashBalance,
        totalAssets: cashBalance + holdingsValue,
        profitLoss: cashBalance + holdingsValue - 100000,
        holdings,
        trades: user.trades.map((t) => ({
          id: t.id,
          symbol: t.symbol,
          side: t.side,
          quantity: t.quantity,
          price: t.price,
          total: t.total,
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
