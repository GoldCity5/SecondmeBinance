import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SnapshotPeriod } from "@/types";

const INITIAL_CAPITAL = 100000;

function getStartDate(period: SnapshotPeriod): Date | null {
  const now = new Date();
  switch (period) {
    case "1D":
      return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    case "1W":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "1M":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3M":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "ALL":
      return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const period = (req.nextUrl.searchParams.get("period") || "1W") as SnapshotPeriod;

  if (!userId) {
    return NextResponse.json({ code: -1, message: "缺少 userId" }, { status: 400 });
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId },
  });

  if (!portfolio) {
    return NextResponse.json({ code: -1, message: "投资组合不存在" }, { status: 404 });
  }

  const startDate = getStartDate(period);
  const startDateStr = startDate ? startDate.toISOString().slice(0, 10) : undefined;

  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: {
      portfolioId: portfolio.id,
      ...(startDateStr ? { date: { gte: startDateStr } } : {}),
    },
    orderBy: { date: "asc" },
  });

  const data = snapshots.map((s) => ({
    date: s.date,
    totalAssets: s.totalAssets,
    profitLoss: s.totalAssets - INITIAL_CAPITAL,
  }));

  return NextResponse.json({ code: 0, data });
}
