import { prisma } from "./prisma";
import { getCoinPrices } from "./binance";
import { calcLeveragedValue } from "./leverage";

/** 获取当天日期字符串 "YYYY-MM-DD" */
function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 为指定用户创建/更新当日快照
 * 同一天多次调用只保留最新值（upsert）
 */
export async function createSnapshotForUser(
  portfolioId: string,
  prices: Record<string, number>
): Promise<void> {
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { holdings: true },
  });
  if (!portfolio) return;

  const holdingsValue = portfolio.holdings.reduce((sum, h) => {
    const price = prices[h.symbol] || 0;
    return sum + calcLeveragedValue(h.quantity, h.avgCost, price, h.leverage);
  }, 0);

  const totalAssets = portfolio.cashBalance + holdingsValue;
  const date = getTodayDate();

  await prisma.portfolioSnapshot.upsert({
    where: {
      portfolioId_date: { portfolioId: portfolio.id, date },
    },
    update: { totalAssets, cashBalance: portfolio.cashBalance, holdingsValue },
    create: {
      portfolioId: portfolio.id,
      date,
      totalAssets,
      cashBalance: portfolio.cashBalance,
      holdingsValue,
    },
  });
}

/**
 * 为所有用户批量创建当日快照
 * 获取一次行情，为每个用户 upsert 快照
 */
export async function createSnapshotForAllUsers(
  prices: Record<string, number>
): Promise<void> {
  const portfolios = await prisma.portfolio.findMany({
    include: { holdings: true },
  });

  const date = getTodayDate();

  await Promise.all(
    portfolios.map(async (portfolio) => {
      const holdingsValue = portfolio.holdings.reduce((sum, h) => {
        const price = prices[h.symbol] || 0;
        return sum + calcLeveragedValue(h.quantity, h.avgCost, price, h.leverage);
      }, 0);
      const totalAssets = portfolio.cashBalance + holdingsValue;

      await prisma.portfolioSnapshot.upsert({
        where: {
          portfolioId_date: { portfolioId: portfolio.id, date },
        },
        update: { totalAssets, cashBalance: portfolio.cashBalance, holdingsValue },
        create: {
          portfolioId: portfolio.id,
          date,
          totalAssets,
          cashBalance: portfolio.cashBalance,
          holdingsValue,
        },
      });
    })
  );
}

/**
 * 收集所有用户持有的 symbol，一次性获取行情
 */
export async function getAllHoldingPrices(): Promise<Record<string, number>> {
  const holdings = await prisma.holding.findMany({
    select: { symbol: true },
    distinct: ["symbol"],
  });
  const symbols = holdings.map((h) => h.symbol);
  if (symbols.length === 0) return {};
  return getCoinPrices(symbols);
}
