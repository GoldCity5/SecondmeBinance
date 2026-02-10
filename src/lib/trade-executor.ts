import { prisma } from "./prisma";
import { getCoinPrice } from "./binance";
import { TradeDecision } from "@/types";
import { calcLeveragedRevenue } from "./leverage";
import { PrismaPromise } from "@/generated/prisma";

/**
 * 执行单笔交易（BUY 或 SELL），支持杠杆
 */
export async function executeSingleTrade(
  userId: string,
  portfolioId: string,
  decision: TradeDecision
) {
  const price = await getCoinPrice(decision.symbol);
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { holdings: true },
  });

  if (!portfolio) return;
  const monologue = decision.monologue || "";
  const leverage = Math.max(1, Math.min(10, Math.round(decision.leverage || 1)));

  if (decision.action === "BUY") {
    await executeBuy(userId, portfolio, decision, price, leverage, monologue);
  } else if (decision.action === "SELL") {
    await executeSell(userId, portfolio, decision, price, monologue);
  }
}

async function executeBuy(
  userId: string,
  portfolio: { id: string; cashBalance: number; holdings: { id: string; symbol: string; quantity: number; avgCost: number; leverage: number }[] },
  decision: TradeDecision,
  price: number,
  leverage: number,
  monologue: string
) {
  const spendAmount = portfolio.cashBalance * (decision.percentage / 100);
  if (spendAmount < 1) return;
  const quantity = spendAmount / price;

  // 查找同 symbol + 同 leverage 的持仓
  const existing = portfolio.holdings.find(
    (h) => h.symbol === decision.symbol && h.leverage === leverage
  );

  await prisma.$transaction([
    prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { cashBalance: { decrement: spendAmount } },
    }),
    existing
      ? prisma.holding.update({
          where: { id: existing.id },
          data: {
            quantity: { increment: quantity },
            avgCost:
              (existing.avgCost * existing.quantity + price * quantity) /
              (existing.quantity + quantity),
          },
        })
      : prisma.holding.create({
          data: {
            portfolioId: portfolio.id,
            symbol: decision.symbol,
            quantity,
            avgCost: price,
            leverage,
          },
        }),
    prisma.trade.create({
      data: {
        userId,
        symbol: decision.symbol,
        side: "BUY",
        quantity,
        price,
        total: spendAmount,
        leverage,
        reason: decision.reason,
        monologue,
      },
    }),
  ]);
}

async function executeSell(
  userId: string,
  portfolio: { id: string; holdings: { id: string; symbol: string; quantity: number; avgCost: number; leverage: number }[] },
  decision: TradeDecision,
  price: number,
  monologue: string
) {
  // 找该 symbol 下所有杠杆仓位
  const holdings = portfolio.holdings.filter((h) => h.symbol === decision.symbol);
  if (holdings.length === 0) return;

  const ratio = decision.percentage / 100;
  let totalRevenue = 0;
  let totalSellQty = 0;
  let leverageWeightedSum = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: PrismaPromise<any>[] = [];

  for (const h of holdings) {
    const sellQty = h.quantity * ratio;
    if (sellQty <= 0) continue;

    const revenue = calcLeveragedRevenue(sellQty, h.avgCost, price, h.leverage);
    totalRevenue += revenue;
    totalSellQty += sellQty;
    leverageWeightedSum += h.leverage * sellQty;

    const remainQty = h.quantity - sellQty;
    if (remainQty <= 0.00001) {
      ops.push(prisma.holding.delete({ where: { id: h.id } }));
    } else {
      ops.push(prisma.holding.update({ where: { id: h.id }, data: { quantity: remainQty } }));
    }
  }

  if (totalSellQty <= 0) return;

  const avgLeverage = Math.round(leverageWeightedSum / totalSellQty);

  ops.push(
    prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { cashBalance: { increment: totalRevenue } },
    }),
    prisma.trade.create({
      data: {
        userId,
        symbol: decision.symbol,
        side: "SELL",
        quantity: totalSellQty,
        price,
        total: totalRevenue,
        leverage: avgLeverage || 1,
        reason: decision.reason,
        monologue,
      },
    })
  );

  await prisma.$transaction(ops);
}
