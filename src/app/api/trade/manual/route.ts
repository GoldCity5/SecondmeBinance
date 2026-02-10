import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ManualTradeRequest, TradeDecision } from "@/types";
import { executeSingleTrade } from "@/lib/trade-executor";
import { checkAndLiquidate } from "@/lib/leverage";
import { getCoinPrice } from "@/lib/binance";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ code: -1, message: "未登录" }, { status: 401 });
  }

  const body: ManualTradeRequest = await req.json();
  const { symbol, action, percentage, leverage } = body;

  if (!symbol || !action || !percentage) {
    return NextResponse.json({ code: -1, message: "参数不完整" }, { status: 400 });
  }
  if (percentage < 1 || percentage > 100) {
    return NextResponse.json({ code: -1, message: "百分比需在 1-100 之间" }, { status: 400 });
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId_type: { userId: session.userId, type: "MANUAL" } },
    include: { holdings: true },
  });

  if (!portfolio) {
    return NextResponse.json({ code: -1, message: "真人账户未开启" }, { status: 404 });
  }

  if (portfolio.liquidatedAt) {
    return NextResponse.json({ code: -1, message: "账户已爆仓" }, { status: 400 });
  }

  const decision: TradeDecision = {
    action,
    symbol,
    percentage,
    leverage: Math.max(1, Math.min(10, Math.round(leverage || 1))),
    reason: "真人手动交易",
  };

  try {
    await executeSingleTrade(session.userId, portfolio.id, decision);

    // 检查爆仓
    const price = await getCoinPrice(symbol);
    const prices: Record<string, number> = { [symbol]: price };
    for (const h of portfolio.holdings) {
      if (!prices[h.symbol]) {
        prices[h.symbol] = await getCoinPrice(h.symbol);
      }
    }
    const liquidated = await checkAndLiquidate(portfolio.id, prices);

    return NextResponse.json({
      code: 0,
      data: { executed: true, liquidated },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[真人交易] 执行失败:", msg);
    return NextResponse.json({ code: -1, message: `交易失败: ${msg}` }, { status: 500 });
  }
}
