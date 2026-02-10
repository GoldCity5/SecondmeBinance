import { prisma } from "./prisma";
import { getCoinPrice } from "./binance";
import { TradeDecision } from "@/types";

/**
 * 执行单笔交易（BUY 或 SELL）
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

  if (decision.action === "BUY") {
    const spendAmount = portfolio.cashBalance * (decision.percentage / 100);
    if (spendAmount < 1) return;
    const quantity = spendAmount / price;

    const existingHolding = portfolio.holdings.find(
      (h) => h.symbol === decision.symbol
    );

    await prisma.$transaction([
      prisma.portfolio.update({
        where: { id: portfolioId },
        data: { cashBalance: { decrement: spendAmount } },
      }),
      existingHolding
        ? prisma.holding.update({
            where: { id: existingHolding.id },
            data: {
              quantity: { increment: quantity },
              avgCost:
                (existingHolding.avgCost * existingHolding.quantity +
                  price * quantity) /
                (existingHolding.quantity + quantity),
            },
          })
        : prisma.holding.create({
            data: { portfolioId, symbol: decision.symbol, quantity, avgCost: price },
          }),
      prisma.trade.create({
        data: {
          userId,
          symbol: decision.symbol,
          side: "BUY",
          quantity,
          price,
          total: spendAmount,
          reason: decision.reason,
          monologue,
        },
      }),
    ]);
  } else if (decision.action === "SELL") {
    const holding = portfolio.holdings.find(
      (h) => h.symbol === decision.symbol
    );
    if (!holding || holding.quantity <= 0) return;

    const sellQuantity = holding.quantity * (decision.percentage / 100);
    if (sellQuantity <= 0) return;
    const revenue = sellQuantity * price;
    const remainingQty = holding.quantity - sellQuantity;

    await prisma.$transaction([
      prisma.portfolio.update({
        where: { id: portfolioId },
        data: { cashBalance: { increment: revenue } },
      }),
      remainingQty <= 0.00001
        ? prisma.holding.delete({ where: { id: holding.id } })
        : prisma.holding.update({
            where: { id: holding.id },
            data: { quantity: remainingQty },
          }),
      prisma.trade.create({
        data: {
          userId,
          symbol: decision.symbol,
          side: "SELL",
          quantity: sellQuantity,
          price,
          total: revenue,
          reason: decision.reason,
          monologue,
        },
      }),
    ]);
  }
}
