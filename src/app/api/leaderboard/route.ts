import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";
import { calcLeveragedValue } from "@/lib/leverage";
import { LeaderboardEntry } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        portfolio: { include: { holdings: true } },
        trades: { orderBy: { createdAt: "desc" }, take: 3 },
      },
    });

    const allSymbols = new Set<string>();
    for (const user of users) {
      for (const h of user.portfolio?.holdings || []) {
        allSymbols.add(h.symbol);
      }
    }

    const prices = allSymbols.size > 0
      ? await getCoinPrices([...allSymbols])
      : {};

    const initialFund = Number(process.env.INITIAL_FUND) || 100000;

    const entries: LeaderboardEntry[] = users.map((user) => {
      const cash = user.portfolio?.cashBalance || 0;
      const isLiquidated = !!user.portfolio?.liquidatedAt;
      let holdingsValue = 0;

      const holdings = (user.portfolio?.holdings || []).map((h) => {
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

      const latestWithMonologue = user.trades.find((t) => t.monologue);

      return {
        rank: 0,
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        tradingStyle: user.tradingStyle || "",
        totalAssets,
        profitLoss,
        profitLossPercent,
        holdingsCount: holdings.length,
        isLiquidated,
        holdings,
        latestMonologue: latestWithMonologue?.monologue || null,
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
