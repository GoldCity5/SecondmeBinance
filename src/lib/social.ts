import { prisma } from "./prisma";
import { getTradeDecision, refreshToken } from "./secondme";
import { getStyleById } from "./styles";

const CONCURRENCY = 5;
const INITIAL_ASSETS = 100000;

interface AISummary {
  id: string;
  name: string;
  styleName: string;
  totalAssets: number;
  profitPercent: number;
  isLiquidated: boolean;
  latestTrades: string[];
}

interface SocialPost {
  content: string;
  postType: string;
  mentionName: string | null;
}

/** 并发控制 */
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

/** 构建所有 AI 的社交上下文摘要 */
async function buildAISummaries(): Promise<AISummary[]> {
  const users = await prisma.user.findMany({
    include: {
      portfolios: {
        where: { type: "AI" },
        include: {
          holdings: true,
          trades: { orderBy: { createdAt: "desc" }, take: 2 },
        },
      },
    },
  });

  return users.map((u) => {
    const portfolio = u.portfolios[0];
    if (!portfolio) {
      return {
        id: u.id, name: u.name, styleName: "未知",
        totalAssets: 0, profitPercent: -100, isLiquidated: true, latestTrades: [],
      };
    }

    const holdingsValue = portfolio.holdings.reduce(
      (sum, h) => sum + h.quantity * h.avgCost, 0
    );
    const totalAssets = portfolio.cashBalance + holdingsValue;
    const profitPercent = ((totalAssets - INITIAL_ASSETS) / INITIAL_ASSETS) * 100;

    const style = getStyleById(u.tradingStyle);
    const styleName = style ? `${style.emoji}${style.name}` : "自定义流派";

    const latestTrades = portfolio.trades.map((t) => {
      const lev = t.leverage > 1 ? ` ${t.leverage}x杠杆` : "";
      return `${t.side} ${t.symbol.replace("USDT", "")}${lev}`;
    });

    return {
      id: u.id, name: u.name, styleName,
      totalAssets, profitPercent,
      isLiquidated: !!portfolio.liquidatedAt,
      latestTrades,
    };
  });
}

/** 为单个 AI 生成社交动态 */
async function generatePostsForUser(
  userId: string,
  accessToken: string,
  selfSummary: AISummary,
  otherSummaries: AISummary[],
  stylePersona: string,
  nameToId: Map<string, string>
): Promise<number> {
  const selfInfo = selfSummary.isLiquidated
    ? `你已经爆仓了！总资产归零。`
    : `你的持仓收益：总资产 $${selfSummary.totalAssets.toFixed(0)}，收益率 ${selfSummary.profitPercent >= 0 ? "+" : ""}${selfSummary.profitPercent.toFixed(1)}%
最近操作：${selfSummary.latestTrades.join("、") || "暂无操作"}`;

  const othersInfo = otherSummaries
    .map((o) => {
      if (o.isLiquidated) return `- ${o.name}（${o.styleName}）：已爆仓！`;
      const trades = o.latestTrades.length > 0 ? `，刚${o.latestTrades.join("、")}` : "";
      return `- ${o.name}（${o.styleName}）：总资产 $${o.totalAssets.toFixed(0)} (${o.profitPercent >= 0 ? "+" : ""}${o.profitPercent.toFixed(1)}%)${trades}`;
    })
    .join("\n");

  const message = `${selfInfo}\n\n其他AI交易员：\n${othersInfo}`;

  const actionControl = `仅输出合法 JSON 数组，不要解释。
结构：[{"content": "动态内容", "postType": "roast"|"praise"|"trade_comment"|"copy_trade"|"liquidation", "mentionName": "被@的人名或null"}]
你是一个虚拟炒币AI，刚做完交易，现在要在"AI广场"发动态。

规则：
1. 输出 1-2 条动态
2. content 用中文，20-50字，要有趣、毒舌、有个性
3. 可以 @其他AI（用 mentionName 指定他们的名字），互喷、嘲讽、或者夸赞
4. postType 选择：
   - "trade_comment": 评论自己的交易
   - "roast": 嘲讽/互喷其他AI
   - "praise": 夸赞/舔大佬
   - "copy_trade": 宣布跟单某人
   - "liquidation": 爆仓哀嚎（仅当你已爆仓时使用）
5. 风格要符合你的交易流派人设
6. 如果你已爆仓，发一条爆仓哀嚎或自嘲
7. 信息不足时返回 [{"content": "今天行情一般，观望一下", "postType": "trade_comment", "mentionName": null}]

【你的交易流派】
${stylePersona}`;

  try {
    // 复用 getTradeDecision 的 SSE 解析模式，但自定义 prompt
    const API_BASE = process.env.SECONDME_API_BASE || "https://app.mindos.com/gate/lab";
    const res = await fetch(`${API_BASE}/api/secondme/act/stream`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, actionControl }),
    });

    if (!res.ok) {
      console.error(`[社交] 用户 ${selfSummary.name}: Act API 错误 ${res.status}`);
      return 0;
    }

    const text = await res.text();
    const lines = text.split("\n");
    let content = "";
    for (const line of lines) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.choices?.[0]?.delta?.content) {
            content += parsed.choices[0].delta.content;
          }
        } catch { /* skip */ }
      }
    }

    content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    console.log(`[社交] 用户 ${selfSummary.name}: AI 返回:`, content.substring(0, 200));

    const posts: SocialPost[] = JSON.parse(content);

    let created = 0;
    for (const post of posts.slice(0, 2)) {
      const mentionedUserId = post.mentionName
        ? nameToId.get(post.mentionName) || null
        : null;

      await prisma.post.create({
        data: {
          userId,
          content: post.content.slice(0, 200),
          postType: post.postType || "trade_comment",
          mentionedUserId,
        },
      });
      created++;
    }

    console.log(`[社交] 用户 ${selfSummary.name}: 生成 ${created} 条动态`);
    return created;
  } catch (err) {
    console.error(`[社交] 用户 ${selfSummary.name}: 生成失败:`, err);
    return 0;
  }
}

/** 为所有 AI 生成社交动态（主入口） */
export async function generateSocialPosts(): Promise<number> {
  console.log("[社交] 开始生成 AI 社交动态...");

  const summaries = await buildAISummaries();
  if (summaries.length === 0) {
    console.log("[社交] 没有 AI 用户，跳过");
    return 0;
  }

  // 名字 → userId 映射，用于解析 @提及
  const nameToId = new Map(summaries.map((s) => [s.name, s.id]));

  // 获取所有用户的 token
  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, accessToken: true, refreshToken: true,
      tokenExpiresAt: true, tradingStyle: true, customPersona: true,
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const tasks = summaries.map((self) => async () => {
    const user = userMap.get(self.id);
    if (!user) return 0;

    // Token 刷新检查
    let accessToken = user.accessToken;
    if (new Date() >= new Date(new Date(user.tokenExpiresAt).getTime() - 5 * 60 * 1000)) {
      try {
        const newToken = await refreshToken(user.refreshToken);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accessToken: newToken.accessToken,
            refreshToken: newToken.refreshToken,
            tokenExpiresAt: new Date(Date.now() + newToken.expiresIn * 1000),
          },
        });
        accessToken = newToken.accessToken;
      } catch {
        console.error(`[社交] 用户 ${user.name}: Token刷新失败`);
        return 0;
      }
    }

    // 流派人设
    let stylePersona = "你是一个普通的虚拟货币交易AI。";
    if (user.customPersona) {
      stylePersona = user.customPersona;
    } else if (user.tradingStyle) {
      const style = getStyleById(user.tradingStyle);
      if (style) stylePersona = style.promptPersona;
    }

    const others = summaries.filter((s) => s.id !== self.id);
    return generatePostsForUser(user.id, accessToken, self, others, stylePersona, nameToId);
  });

  const results = await parallelLimit(tasks, CONCURRENCY);
  const totalPosts = results.reduce((sum, n) => sum + n, 0);
  console.log(`[社交] 完成，共生成 ${totalPosts} 条动态`);
  return totalPosts;
}
