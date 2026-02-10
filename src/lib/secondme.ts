import { SecondMeToken, SecondMeUser, TradeDecision } from "@/types";

const API_BASE = process.env.SECONDME_API_BASE || "https://app.mindos.com/gate/lab";
const OAUTH_URL = process.env.SECONDME_OAUTH_URL || "https://go.second.me/oauth/";

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SECONDME_CLIENT_ID!,
    redirect_uri: process.env.SECONDME_REDIRECT_URI!,
    response_type: "code",
    state,
  });
  return `${OAUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<SecondMeToken> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.SECONDME_REDIRECT_URI!,
    client_id: process.env.SECONDME_CLIENT_ID!,
    client_secret: process.env.SECONDME_CLIENT_SECRET!,
  });

  const res = await fetch(`${API_BASE}/api/oauth/token/code`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await res.json();
  if (json.code !== 0) throw new Error(`Token exchange failed: ${json.message}`);

  return {
    accessToken: json.data.accessToken,
    refreshToken: json.data.refreshToken,
    expiresIn: json.data.expiresIn,
  };
}

export async function refreshToken(rt: string): Promise<SecondMeToken> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: rt,
    client_id: process.env.SECONDME_CLIENT_ID!,
    client_secret: process.env.SECONDME_CLIENT_SECRET!,
  });

  const res = await fetch(`${API_BASE}/api/oauth/token/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = await res.json();
  if (json.code !== 0) throw new Error(`Token refresh failed: ${json.message}`);

  return {
    accessToken: json.data.accessToken,
    refreshToken: json.data.refreshToken,
    expiresIn: json.data.expiresIn,
  };
}

export async function getUserInfo(accessToken: string): Promise<SecondMeUser> {
  const res = await fetch(`${API_BASE}/api/secondme/user/info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const json = await res.json();
  if (json.code !== 0) throw new Error(`User info failed: ${json.message}`);

  return {
    userId: json.data.userId || json.data.id,
    name: json.data.name,
    email: json.data.email,
    avatar: json.data.avatar || json.data.avatarUrl,
    bio: json.data.bio || json.data.selfIntroduction || "",
  };
}

export async function getUserShades(accessToken: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/secondme/user/shades`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.code !== 0) return [];
    const shades = json.data?.shades || [];
    return shades.map((s: { name?: string; content?: string }) => s.name || s.content || "").filter(Boolean);
  } catch {
    return [];
  }
}

export async function getUserSoftMemory(accessToken: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/secondme/user/softmemory`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.code !== 0) return [];
    const list = json.data?.list || [];
    return list.map((m: { content?: string; summary?: string }) => m.summary || m.content || "").filter(Boolean).slice(0, 5);
  } catch {
    return [];
  }
}

export interface PersonalityProfile {
  shades: string[];
  memories: string[];
  bio: string;
}

export async function getTradeDecision(
  accessToken: string,
  marketData: string,
  personality?: PersonalityProfile,
  stylePersona?: string
): Promise<TradeDecision[]> {
  // 流派人设（优先级最高）
  const styleHint = stylePersona
    ? `\n\n【你的交易流派】\n${stylePersona}\n请严格按照此流派风格做出交易决策和内心独白。`
    : "";

  // 根据个性化数据生成投资风格引导
  let personalityHint = "";
  if (personality) {
    const parts: string[] = [];
    if (personality.bio) parts.push(`你的身份简介: ${personality.bio}`);
    if (personality.shades.length > 0) parts.push(`你的兴趣标签: ${personality.shades.join("、")}`);
    if (personality.memories.length > 0) parts.push(`你的记忆片段: ${personality.memories.join("；")}`);
    if (parts.length > 0) {
      personalityHint = `\n\n【你的个性档案】\n${parts.join("\n")}\n请结合你的个性特征来丰富你的交易风格。`;
    }
  }

  const actionControl = `仅输出合法 JSON 数组，不要解释。
输出结构：[{"action": "BUY"|"SELL"|"HOLD", "symbol": "BTCUSDT", "percentage": 0-100, "leverage": 1-10, "reason": "简短理由", "monologue": "内心独白"}]
你是一个虚拟货币交易AI，根据当前市场行情数据做出交易决策。
规则：
1. action 只能是 BUY、SELL 或 HOLD
2. BUY 时 percentage 表示使用可用现金的百分比购买
3. SELL 时 percentage 表示卖出持仓的百分比
4. HOLD 表示不操作
5. 每次最多输出 3 个交易决策
6. reason 用中文简短说明理由
7. monologue 是你的内心独白，用你的性格风格写一句话（20字以内），表达对这次决策的真实想法，要有趣、有个性
8. leverage 是杠杆倍数（1-10 整数），仅 BUY 时需要，表示用多大的杠杆开仓。1=无杠杆，10=最高杠杆。杠杆越高收益和亏损都会被放大，总资产归零会爆仓
9. SELL 和 HOLD 时不需要 leverage 字段
10. 信息不足时返回 [{"action": "HOLD", "symbol": "BTCUSDT", "percentage": 0, "reason": "信息不足，观望", "monologue": "再看看再说"}]${styleHint}${personalityHint}`;

  const res = await fetch(`${API_BASE}/api/secondme/act/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: marketData,
      actionControl,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[Act API] HTTP ${res.status}:`, errText);
    throw new Error(`Act API error: ${res.status}`);
  }

  const text = await res.text();
  console.log("[Act API] 原始响应:", text.substring(0, 500));

  const lines = text.split("\n");
  let content = "";

  for (const line of lines) {
    if (line.startsWith("data: ") && line !== "data: [DONE]") {
      try {
        const parsed = JSON.parse(line.slice(6));
        if (parsed.choices?.[0]?.delta?.content) {
          content += parsed.choices[0].delta.content;
        }
      } catch {
        // skip non-JSON lines (e.g. event: session)
      }
    }
  }

  // 去掉 markdown 代码块标记 (```json ... ```)
  content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  console.log("[Act API] 清理后内容:", content);

  try {
    const raw = JSON.parse(content) as TradeDecision[];
    // 清洗 leverage 字段：clamp 到 [1, 10]，非数字默认 1
    const decisions = raw.map((d) => ({
      ...d,
      leverage: d.leverage ? Math.max(1, Math.min(10, Math.round(Number(d.leverage) || 1))) : 1,
    }));
    console.log("[Act API] 解析决策:", JSON.stringify(decisions));
    return decisions;
  } catch {
    console.error("[Act API] JSON解析失败，原始内容:", content);
    return [{ action: "HOLD", symbol: "BTCUSDT", percentage: 0, reason: "AI 返回格式异常，暂不操作" }];
  }
}
