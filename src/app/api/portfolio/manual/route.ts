import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST — 开启真人交易账户 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ code: -1, message: "未登录" }, { status: 401 });
  }

  const existing = await prisma.portfolio.findUnique({
    where: { userId_type: { userId: session.userId, type: "MANUAL" } },
  });

  if (existing) {
    return NextResponse.json({ code: 0, data: { portfolioId: existing.id } });
  }

  const portfolio = await prisma.portfolio.create({
    data: {
      userId: session.userId,
      type: "MANUAL",
      cashBalance: Number(process.env.INITIAL_FUND) || 100000,
    },
  });

  return NextResponse.json({ code: 0, data: { portfolioId: portfolio.id } });
}

/** DELETE — 关闭真人交易账户（可选） */
export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ code: -1, message: "未登录" }, { status: 401 });
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId_type: { userId: session.userId, type: "MANUAL" } },
    include: { holdings: true },
  });

  if (!portfolio) {
    return NextResponse.json({ code: -1, message: "真人账户不存在" }, { status: 404 });
  }

  // 清除持仓、交易记录、快照，然后删除 portfolio
  await prisma.$transaction([
    prisma.holding.deleteMany({ where: { portfolioId: portfolio.id } }),
    prisma.trade.deleteMany({ where: { portfolioId: portfolio.id } }),
    prisma.portfolioSnapshot.deleteMany({ where: { portfolioId: portfolio.id } }),
    prisma.portfolio.delete({ where: { id: portfolio.id } }),
  ]);

  return NextResponse.json({ code: 0, data: null });
}
