import { prisma } from "./prisma";
import { getTopCoins, getCoinPrice } from "./binance";
import { CoinTicker, TradeDecision } from "@/types";
import { getTradeDecision, refreshToken, getUserShades, getUserSoftMemory } from "./secondme";

const CONCURRENCY = 5; // 最大并发用户数

export interface TradeResult {
  userId: string;
  userName: string;
  status: "success" | "error" | "no_trade";
  decisions: TradeDecision[];
  executedTrades: number;
  error?: string;
}

/** 并发控制：同时最多 limit 个任务 */
async function parallelLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

/**
 * 为单个用户执行交易，接受共享的行情数据避免重复请求
 */
export async function executeTradeForUser(userId: string, sharedCoins?: CoinTicker[]): Promise<TradeResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { portfolio: { include: { holdings: true } } },
  });

  if (!user || !user.portfolio) {
    return { userId, userName: "unknown", status: "error", decisions: [], executedTrades: 0, error: "用户或投资组合不存在" };
  }

  const result: TradeResult = { userId, userName: user.name, status: "no_trade", decisions: [], executedTrades: 0 };

  // Token 刷新
  let accessToken = user.accessToken;
  if (new Date() >= new Date(user.tokenExpiresAt.getTime() - 5 * 60 * 1000)) {
    try {
      console.log(`[交易] 用户 ${user.name}: 刷新Token...`);
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
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[交易] 用户 ${user.name}: Token刷新失败:`, msg);
      return { ...result, status: "error", error: `Token刷新失败: ${msg}` };
    }
  }

  // 行情：优先用共享数据，否则自己获取（单用户调用场景）
  const coins = sharedCoins || await getTopCoins();

  const holdingsInfo = user.portfolio.holdings
    .map((h) => `${h.symbol}: 持有 ${h.quantity} 个, 均价 $${h.avgCost.toFixed(2)}`)
    .join("; ");

  const marketSummary = `当前时间: ${new Date().toISOString()}
可用现金: $${user.portfolio.cashBalance.toFixed(2)}
当前持仓: ${holdingsInfo || "无"}
市场行情:
${coins.map((c) => `${c.name}: $${c.price} (24h ${c.priceChangePercent >= 0 ? "+" : ""}${c.priceChangePercent.toFixed(2)}%, 成交额 $${(c.quoteVolume / 1e6).toFixed(0)}M)`).join("\n")}`;

  // 获取用户个性数据（并行请求）
  const [shades, memories] = await Promise.all([
    getUserShades(accessToken),
    getUserSoftMemory(accessToken),
  ]);
  const personality = { shades, memories, bio: user.bio || "" };
  console.log(`[交易] 用户 ${user.name}: 兴趣标签=${shades.length}个, 记忆=${memories.length}条`);

  // 获取 AI 决策（最耗时的步骤，~8-10s）
  let decisions: TradeDecision[];
  try {
    console.log(`[交易] 用户 ${user.name}: 请求AI决策...`);
    decisions = await getTradeDecision(accessToken, marketSummary, personality);
    result.decisions = decisions;
    console.log(`[交易] 用户 ${user.name}: AI决策:`, JSON.stringify(decisions));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[交易] 用户 ${user.name}: AI决策失败:`, msg);
    return { ...result, status: "error", error: `AI决策失败: ${msg}` };
  }

  // 执行交易
  for (const decision of decisions) {
    if (decision.action === "HOLD") {
      console.log(`[交易] 用户 ${user.name}: ${decision.symbol} → HOLD (${decision.reason})`);
      continue;
    }
    try {
      await executeSingleTrade(user.id, user.portfolio.id, decision);
      result.executedTrades++;
      result.status = "success";
      console.log(`[交易] 用户 ${user.name}: ${decision.action} ${decision.symbol} 成功`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[交易] 用户 ${user.name}: 交易执行失败:`, msg);
    }
  }

  if (result.executedTrades === 0 && result.status !== "error") {
    result.status = "no_trade";
  }

  return result;
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

  // 行情数据只取一次，所有用户共享
  const coins = await getTopCoins();
  console.log(`[交易] 行情获取完成，开始为 ${users.length} 个用户并发执行交易 (并发上限=${CONCURRENCY})`);

  const tasks = users.map((u) => () => executeTradeForUser(u.id, coins));
  const tradeResults = await parallelLimit(tasks, CONCURRENCY);

  return {
    total: users.length,
    results: tradeResults.map((r) => ({
      userId: r.userId,
      userName: r.userName,
      status: r.status,
      decisions: r.decisions,
      executedTrades: r.executedTrades,
      error: r.error,
    })),
  };
}
