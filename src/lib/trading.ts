import { prisma } from "./prisma";
import { getTopCoins, getCoinPrice } from "./binance";
import { getTradeDecision, refreshToken } from "./secondme";
import { TradeDecision } from "@/types";

export async function executeTradeForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { portfolio: { include: { holdings: true } } },
  });

  if (!user || !user.portfolio) return;

  let accessToken = user.accessToken;
  if (new Date() >= new Date(user.tokenExpiresAt.getTime() - 5 * 60 * 1000)) {
    try {
      const newToken = await refreshToken(user.refreshToken);
      await prisma.user.update({
        where: { id: userId },
        data: {
          accessToken: newToken.accessToken,
          refreshToken: newToken.refreshToken,
          tokenExpiresAt: new Date(Date.now() + newToken.expiresIn * 1000),
        },
      });
      accessToken = newToken.accessToken;
    } catch (err) {
      console.error(`Token refresh failed for user ${userId}:`, err);
      return;
    }
  }

  const coins = await getTopCoins();
  const holdingsInfo = user.portfolio.holdings
    .map((h) => `${h.symbol}: 持有 ${h.quantity} 个, 均价 $${h.avgCost.toFixed(2)}`)
    .join("; ");

  const marketSummary = `当前时间: ${new Date().toISOString()}
可用现金: $${user.portfolio.cashBalance.toFixed(2)}
当前持仓: ${holdingsInfo || "无"}
市场行情:
${coins.map((c) => `${c.name}: $${c.price} (24h ${c.priceChangePercent >= 0 ? "+" : ""}${c.priceChangePercent.toFixed(2)}%, 成交额 $${(c.quoteVolume / 1e6).toFixed(0)}M)`).join("\n")}`;

  let decisions: TradeDecision[];
  try {
    decisions = await getTradeDecision(accessToken, marketSummary);
  } catch (err) {
    console.error(`Trade decision failed for user ${userId}:`, err);
    return;
  }

  for (const decision of decisions) {
    if (decision.action === "HOLD") continue;
    try {
      await executeSingleTrade(user.id, user.portfolio.id, decision);
    } catch (err) {
      console.error(`Trade execution failed:`, err);
    }
  }
}

async function executeSingleTrade(
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
            data: {
              portfolioId,
              symbol: decision.symbol,
              quantity,
              avgCost: price,
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
          reason: decision.reason,
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
        },
      }),
    ]);
  }
}

export async function executeTradeForAllUsers() {
  const users = await prisma.user.findMany({ select: { id: true } });
  const results = await Promise.allSettled(
    users.map((u) => executeTradeForUser(u.id))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  return { total: users.length, succeeded, failed };
}
