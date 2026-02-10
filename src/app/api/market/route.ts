import { NextResponse } from "next/server";
import { getTopCoins, getAllKlines } from "@/lib/binance";

export async function GET() {
  try {
    const coins = await getTopCoins();

    // 并行获取所有币种 K 线
    const symbols = coins.map((c) => c.symbol);
    const klines = await getAllKlines(symbols);

    const coinsWithKline = coins.map((c) => ({
      ...c,
      kline: klines[c.symbol] || [],
    }));

    return NextResponse.json({ code: 0, data: coinsWithKline });
  } catch (err) {
    console.error("Market API error:", err);
    return NextResponse.json(
      { code: 500, message: "获取行情失败" },
      { status: 500 }
    );
  }
}
