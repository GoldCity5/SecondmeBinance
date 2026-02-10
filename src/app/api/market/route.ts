import { NextResponse } from "next/server";
import { getTopCoins } from "@/lib/binance";

export async function GET() {
  try {
    const coins = await getTopCoins();
    return NextResponse.json({ code: 0, data: coins });
  } catch (err) {
    console.error("Market API error:", err);
    return NextResponse.json({ code: 500, message: "获取行情失败" }, { status: 500 });
  }
}
