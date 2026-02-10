import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TRADING_STYLES } from "@/lib/styles";

const VALID_IDS = new Set(TRADING_STYLES.map((s) => s.id));
const MAX_PERSONA_LENGTH = 200;

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ code: -1, message: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const { styleId, customPersona } = body as { styleId?: string; customPersona?: string };

  // 自定义人设
  if (typeof customPersona === "string") {
    const trimmed = customPersona.trim().slice(0, MAX_PERSONA_LENGTH);
    await prisma.user.update({
      where: { id: session.userId },
      data: { customPersona: trimmed },
    });
    return NextResponse.json({ code: 0, data: { customPersona: trimmed } });
  }

  // 切换预设流派（同时清空自定义人设）
  if (styleId && VALID_IDS.has(styleId)) {
    await prisma.user.update({
      where: { id: session.userId },
      data: { tradingStyle: styleId, customPersona: "" },
    });
    return NextResponse.json({ code: 0, data: { styleId } });
  }

  return NextResponse.json({ code: -1, message: "参数无效" }, { status: 400 });
}
