import { prisma } from "./prisma";

/** 计算杠杆持仓市值 */
export function calcLeveragedValue(
  quantity: number,
  avgCost: number,
  currentPrice: number,
  leverage: number
): number {
  return quantity * (avgCost + (currentPrice - avgCost) * leverage);
}

/** 计算杠杆卖出收入（不低于 0） */
export function calcLeveragedRevenue(
  sellQty: number,
  avgCost: number,
  currentPrice: number,
  leverage: number
): number {
  return Math.max(0, sellQty * (avgCost + (currentPrice - avgCost) * leverage));
}

/**
 * 检查并执行爆仓：totalAssets <= 0 则清仓归零
 * @returns true 表示已爆仓
 */
export async function checkAndLiquidate(
  portfolioId: string,
  prices: Record<string, number>
): Promise<boolean> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { holdings: true },
  });
  if (!portfolio || portfolio.liquidatedAt) return !!portfolio?.liquidatedAt;

  let holdingsValue = 0;
  for (const h of portfolio.holdings) {
    const price = prices[h.symbol];
    if (price == null) continue;
    holdingsValue += calcLeveragedValue(h.quantity, h.avgCost, price, h.leverage);
  }

  const totalAssets = portfolio.cashBalance + holdingsValue;
  if (totalAssets > 0) return false;

  // 爆仓：清空持仓，余额归零
  await prisma.$transaction([
    prisma.holding.deleteMany({ where: { portfolioId } }),
    prisma.portfolio.update({
      where: { id: portfolioId },
      data: { cashBalance: 0, liquidatedAt: new Date() },
    }),
  ]);

  console.log(`[爆仓] Portfolio ${portfolioId}: 总资产 $${totalAssets.toFixed(2)} <= 0，已爆仓`);
  return true;
}
