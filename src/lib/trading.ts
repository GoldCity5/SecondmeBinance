import { prisma } from "./prisma";
import { getTopCoins, getCoinPrices } from "./binance";
import { CoinTicker, TradeDecision } from "@/types";
import { getTradeDecision, refreshToken, getUserShades, getUserSoftMemory } from "./secondme";
import { createSnapshotForAllUsers } from "./snapshot";
import { executeSingleTrade } from "./trade-executor";
import { matchStyle, getStyleById } from "./styles";
import { calcLeveragedValue, checkAndLiquidate } from "./leverage";

const CONCURRENCY = 5;

export interface TradeResult {
  userId: string;
  userName: string;
  status: "success" | "error" | "no_trade" | "liquidated";
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
    include: {
      portfolios: {
        where: { type: "AI" },
        include: { holdings: true },
      },
    },
  });

  const portfolio = user?.portfolios[0];
  if (!user || !portfolio) {
    return { userId, userName: "unknown", status: "error", decisions: [], executedTrades: 0, error: "用户或投资组合不存在" };
  }

  // 已爆仓用户跳过交易
  if (portfolio.liquidatedAt) {
    console.log(`[交易] 用户 ${user.name}: 已爆仓，跳过`);
    return { userId, userName: user.name, status: "liquidated", decisions: [], executedTrades: 0 };
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

  const coins = sharedCoins || await getTopCoins();

  // 获取用户个性数据（并行请求）
  const [shades, memories] = await Promise.all([
    getUserShades(accessToken),
    getUserSoftMemory(accessToken),
  ]);
  const personality = { shades, memories, bio: user.bio || "" };
  console.log(`[交易] 用户 ${user.name}: 兴趣标签=${shades.length}个, 记忆=${memories.length}条`);

  // 流派：customPersona 优先，否则走预设流派
  let stylePersona: string | undefined;
  if (user.customPersona) {
    stylePersona = user.customPersona;
    console.log(`[交易] 用户 ${user.name}: 使用自定义人设`);
  } else if (!user.tradingStyle) {
    const styleId = matchStyle(shades, memories, user.bio || "");
    await prisma.user.update({ where: { id: userId }, data: { tradingStyle: styleId } });
    console.log(`[交易] 用户 ${user.name}: 自动匹配流派 → ${styleId}`);
    stylePersona = getStyleById(styleId)?.promptPersona;
  } else {
    stylePersona = getStyleById(user.tradingStyle)?.promptPersona;
  }

  const holdingsInfo = portfolio.holdings
    .map((h) => {
      const lev = h.leverage > 1 ? ` (${h.leverage}x杠杆)` : "";
      return `${h.symbol}: 持有 ${h.quantity} 个, 均价 $${h.avgCost.toFixed(2)}${lev}`;
    })
    .join("; ");

  const marketSummary = `当前时间: ${new Date().toISOString()}
可用现金: $${portfolio.cashBalance.toFixed(2)}
当前持仓: ${holdingsInfo || "无"}
市场行情:
${coins.map((c) => `${c.name}: $${c.price} (24h ${c.priceChangePercent >= 0 ? "+" : ""}${c.priceChangePercent.toFixed(2)}%, 成交额 $${(c.quoteVolume / 1e6).toFixed(0)}M)`).join("\n")}`;

  // 获取 AI 决策
  let decisions: TradeDecision[];
  try {
    console.log(`[交易] 用户 ${user.name}: 请求AI决策...`);
    decisions = await getTradeDecision(accessToken, marketSummary, personality, stylePersona);
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
      await executeSingleTrade(user.id, portfolio.id, decision);
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

  // 交易后检查爆仓
  if (result.executedTrades > 0) {
    const prices: Record<string, number> = {};
    for (const c of coins) prices[c.symbol] = c.price;
    const liquidated = await checkAndLiquidate(portfolio.id, prices);
    if (liquidated) {
      console.log(`[交易] 用户 ${user.name}: 交易后触发爆仓！`);
      result.status = "liquidated";
    }
  }

  return result;
}

export async function executeTradeForAllUsers() {
  const users = await prisma.user.findMany({ select: { id: true } });

  const coins = await getTopCoins();
  console.log(`[交易] 行情获取完成，开始为 ${users.length} 个用户并发执行交易 (并发上限=${CONCURRENCY})`);

  const tasks = users.map((u) => () => executeTradeForUser(u.id, coins));
  const tradeResults = await parallelLimit(tasks, CONCURRENCY);

  // 交易完成后，为所有用户创建当日快照
  try {
    const allSymbols = [...new Set(coins.map((c) => c.symbol))];
    const holdingSymbols = await prisma.holding.findMany({
      select: { symbol: true },
      distinct: ["symbol"],
    });
    const extraSymbols = holdingSymbols.map((h) => h.symbol).filter((s) => !allSymbols.includes(s));
    const allPrices: Record<string, number> = {};
    for (const c of coins) allPrices[c.symbol] = c.price;
    if (extraSymbols.length > 0) {
      const extra = await getCoinPrices(extraSymbols);
      Object.assign(allPrices, extra);
    }
    await createSnapshotForAllUsers(allPrices);
    console.log("[快照] 已为所有用户创建当日快照");
  } catch (err) {
    console.error("[快照] 创建快照失败:", err);
  }

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
