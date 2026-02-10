import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";
import { calcLeveragedValue } from "@/lib/leverage";
import { LeaderboardEntry, PortfolioType } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const typeParam = req.nextUrl.searchParams.get("type")?.toUpperCase(); // AI | MANUAL | ALL
  const typeFilter: { type?: string } =
    typeParam === "MANUAL" ? { type: "MANUAL" } :
    typeParam === "ALL" ? {} :
    { type: "AI" }; // 默认 AI

  try {
    const portfolios = await prisma.portfolio.findMany({
      where: typeFilter,
      include: {
        user: true,
        holdings: true,
        trades: { orderBy: { createdAt: "desc" }, take: 3 },
      },
    });

    const allSymbols = new Set<string>();
    for (const p of portfolios) {
      for (const h of p.holdings) allSymbols.add(h.symbol);
    }

    const prices = allSymbols.size > 0
      ? await getCoinPrices([...allSymbols])
      : {};

    const initialFund = Number(process.env.INITIAL_FUND) || 100000;

    const entries: LeaderboardEntry[] = portfolios.map((p) => {
      const cash = p.cashBalance;
      const isLiquidated = !!p.liquidatedAt;
      let holdingsValue = 0;

      const holdings = p.holdings.map((h) => {
        const currentPrice = prices[h.symbol] || 0;
        const mv = calcLeveragedValue(h.quantity, h.avgCost, currentPrice, h.leverage);
        holdingsValue += mv;
        const costValue = h.quantity * h.avgCost;
        return {
          symbol: h.symbol,
          leverage: h.leverage,
          profitLossPercent: costValue > 0 ? ((mv - costValue) / costValue) * 100 : 0,
        };
      });

      const totalAssets = isLiquidated ? 0 : cash + holdingsValue;
      const profitLoss = totalAssets - initialFund;
      const profitLossPercent = (profitLoss / initialFund) * 100;

      const latestWithMonologue = p.trades.find((t) => t.monologue);

      return {
        rank: 0,
        userId: p.userId,
        name: p.user.name,
        avatar: p.user.avatar,
        tradingStyle: p.type === "AI" ? (p.user.tradingStyle || "") : "",
        customPersona: p.type === "AI" ? (p.user.customPersona || "") : "",
        totalAssets,
        profitLoss,
        profitLossPercent,
        holdingsCount: holdings.length,
        isLiquidated,
        holdings,
        latestMonologue: p.type === "AI" ? (latestWithMonologue?.monologue || null) : null,
        type: p.type as PortfolioType,
      };
    });

    entries.sort((a, b) => b.totalAssets - a.totalAssets);
    entries.forEach((e, i) => (e.rank = i + 1));

    return NextResponse.json({ code: 0, data: entries });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json({ code: 500, message: "获取排行榜失败" }, { status: 500 });
  }
}
