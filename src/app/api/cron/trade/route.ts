import { NextRequest, NextResponse } from "next/server";
import { executeTradeForAllUsers } from "@/lib/trading";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await executeTradeForAllUsers();
    return NextResponse.json({
      code: 0,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Cron trade error:", err);
    return NextResponse.json({ code: 500, message: "交易执行失败" }, { status: 500 });
  }
}
