import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";
import { LeaderboardEntry } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        portfolio: { include: { holdings: true } },
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

    const initialFund = parseFloat(process.env.INITIAL_FUND || "100000");

    const entries: LeaderboardEntry[] = users.map((user) => {
      const cash = user.portfolio?.cashBalance || 0;
      let holdingsValue = 0;

      for (const h of user.portfolio?.holdings || []) {
        holdingsValue += h.quantity * (prices[h.symbol] || 0);
      }

      const totalAssets = cash + holdingsValue;
      const profitLoss = totalAssets - initialFund;
      const profitLossPercent = (profitLoss / initialFund) * 100;

      return {
        rank: 0,
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        totalAssets,
        profitLoss,
        profitLossPercent,
        holdingsCount: user.portfolio?.holdings.length || 0,
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
