import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TRADING_STYLES } from "@/lib/styles";

const VALID_IDS = new Set(TRADING_STYLES.map((s) => s.id));

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ code: -1, message: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const { styleId } = body as { styleId: string };

  if (!styleId || !VALID_IDS.has(styleId)) {
    return NextResponse.json({ code: -1, message: "无效的流派 ID" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { tradingStyle: styleId },
  });

  return NextResponse.json({ code: 0, data: { styleId } });
}
