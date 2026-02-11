import { NextRequest, NextResponse } from "next/server";
import { get24hTicker, getDetailedKlines } from "@/lib/binance";
import { prisma } from "@/lib/prisma";
import { KlineInterval, TradeMarker, PortfolioType } from "@/types";

export const dynamic = "force-dynamic";

const VALID_INTERVALS: KlineInterval[] = ["1h", "4h", "1d", "1w"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const interval = (request.nextUrl.searchParams.get("interval") || "1h") as KlineInterval;

  if (!VALID_INTERVALS.includes(interval)) {
    return NextResponse.json({ code: -1, message: "无效的时间周期" }, { status: 400 });
  }

  try {
    const [ticker, klines] = await Promise.all([
      get24hTicker(symbol),
      getDetailedKlines(symbol, interval, 100),
    ]);

    // 查询该币种的近期交易记录，关联用户和 portfolio 获取 type
    const trades = await prisma.trade.findMany({
      where: { symbol },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { name: true } },
        portfolio: { select: { type: true } },
      },
    });

    const tradeMarkers: TradeMarker[] = trades.map((t) => ({
      time: t.createdAt.getTime(),
      price: t.price,
      side: t.side as "BUY" | "SELL",
      type: (t.portfolio.type || "AI") as PortfolioType,
      userName: t.user.name,
    }));

    return NextResponse.json({
      code: 0,
      data: { ticker, klines, tradeMarkers },
    });
  } catch (err) {
    console.error("Market detail error:", err);
    return NextResponse.json({ code: 500, message: "获取数据失败" }, { status: 500 });
  }
}
