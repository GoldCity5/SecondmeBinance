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

export async function getTradeDecision(
  accessToken: string,
  marketData: string
): Promise<TradeDecision[]> {
  const actionControl = `仅输出合法 JSON 数组，不要解释。
输出结构：[{"action": "BUY"|"SELL"|"HOLD", "symbol": "BTCUSDT", "percentage": 0-100, "reason": "简短理由"}]
你是一个虚拟货币交易AI，根据当前市场行情数据做出交易决策。
规则：
1. action 只能是 BUY、SELL 或 HOLD
2. BUY 时 percentage 表示使用可用现金的百分比购买
3. SELL 时 percentage 表示卖出持仓的百分比
4. HOLD 表示不操作
5. 每次最多输出 3 个交易决策
6. reason 用中文简短说明理由
7. 信息不足时返回 [{"action": "HOLD", "symbol": "BTCUSDT", "percentage": 0, "reason": "信息不足，观望"}]`;

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

  if (!res.ok) throw new Error(`Act API error: ${res.status}`);

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
      } catch {
        // skip non-JSON lines
      }
    }
  }

  try {
    return JSON.parse(content) as TradeDecision[];
  } catch {
    return [{ action: "HOLD", symbol: "BTCUSDT", percentage: 0, reason: "AI 返回格式异常，暂不操作" }];
  }
}
