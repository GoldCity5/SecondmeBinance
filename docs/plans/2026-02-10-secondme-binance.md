# SecondMe Binance - AI 虚拟炒币竞技平台 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个 AI 虚拟炒币竞技平台，每个用户通过 SecondMe OAuth 登录后，其 AI 分身获得 10 万 USDT 虚拟资金，每小时通过 Act API 自动交易热门虚拟货币，排行榜展示竞技成绩。

**Architecture:** Next.js 14 App Router 全栈应用。前端深色科技风 UI，后端通过 API Routes 代理 SecondMe API 和 Binance API。Prisma + SQLite 存储用户、持仓、交易记录。Cron Job（Vercel Cron / node-cron）每小时触发 AI 交易决策。

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma (SQLite), SecondMe OAuth2 + Act API, Binance Public API

---

## 项目结构

```
SecondmeBinance/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # 首页/排行榜
│   │   ├── globals.css
│   │   ├── login/page.tsx              # 登录页
│   │   ├── dashboard/page.tsx          # 个人面板
│   │   ├── market/page.tsx             # 行情页
│   │   ├── trader/[id]/page.tsx        # AI 详情页
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts      # 发起 OAuth
│   │       │   └── callback/route.ts   # OAuth 回调
│   │       ├── market/
│   │       │   └── route.ts            # 行情数据代理
│   │       ├── leaderboard/
│   │       │   └── route.ts            # 排行榜数据
│   │       ├── trader/
│   │       │   └── [id]/route.ts       # AI 详情数据
│   │       └── cron/
│   │           └── trade/route.ts      # 定时交易触发
│   ├── lib/
│   │   ├── prisma.ts                   # Prisma 客户端
│   │   ├── binance.ts                  # Binance API 封装
│   │   ├── secondme.ts                 # SecondMe API 封装
│   │   ├── auth.ts                     # 认证工具
│   │   └── trading.ts                  # 交易引擎
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   ├── market/
│   │   │   ├── CoinCard.tsx
│   │   │   └── PriceTable.tsx
│   │   ├── leaderboard/
│   │   │   └── LeaderboardTable.tsx
│   │   └── trader/
│   │       ├── PortfolioChart.tsx
│   │       └── TradeHistory.tsx
│   └── types/
│       └── index.ts                    # 全局类型定义
├── scripts/
│   ├── dev.sh
│   ├── build.sh
│   └── db-push.sh
├── .env.local
├── .gitignore
├── CLAUDE.md
└── .secondme/state.json
```

---

## Task 1: 项目初始化与基础配置

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `prisma/schema.prisma`
- Create: `.env.local`
- Create: `.gitignore`
- Create: `scripts/dev.sh`, `scripts/build.sh`, `scripts/db-push.sh`

**Step 1: 初始化 Next.js 项目**

```bash
cd /Users/kongweilong/kwl/SecondmeBinance
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

选择默认选项即可。

**Step 2: 安装额外依赖**

```bash
cd /Users/kongweilong/kwl/SecondmeBinance
npm install prisma @prisma/client
npm install jose
npx prisma init --datasource-provider sqlite
```

- `prisma` + `@prisma/client`：数据库 ORM
- `jose`：JWT 签名/验证（用于 session cookie）

**Step 3: 编写 .env.local**

```env
# SecondMe OAuth
SECONDME_CLIENT_ID=a1574daa-6d76-4061-b934-8e5feba967ee
SECONDME_CLIENT_SECRET=9c92ec42ba71312024dc28c85fcfe86427c35f2a3c764a213982a4b23ed02106
SECONDME_REDIRECT_URI=http://localhost:3000/api/auth/callback
SECONDME_OAUTH_URL=https://go.second.me/oauth/
SECONDME_API_BASE=https://app.mindos.com/gate/lab

# Binance
BINANCE_API_BASE=https://api.binance.com

# App
JWT_SECRET=your-random-secret-at-least-32-chars-long
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=file:./dev.db

# Trading
CRON_SECRET=your-cron-secret-key
INITIAL_FUND=100000
TRADE_INTERVAL_HOURS=1
```

**Step 4: 编写 Prisma Schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id              String     @id @default(cuid())
  secondmeUserId  String     @unique
  name            String
  email           String?
  avatar          String?
  accessToken     String
  refreshToken    String
  tokenExpiresAt  DateTime
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  portfolio       Portfolio?
  trades          Trade[]
}

model Portfolio {
  id            String    @id @default(cuid())
  userId        String    @unique
  user          User      @relation(fields: [userId], references: [id])
  cashBalance   Float     @default(100000)
  holdings      Holding[]
  updatedAt     DateTime  @updatedAt
}

model Holding {
  id          String    @id @default(cuid())
  portfolioId String
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id])
  symbol      String
  quantity    Float
  avgCost     Float
  updatedAt   DateTime  @updatedAt

  @@unique([portfolioId, symbol])
}

model Trade {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  symbol    String
  side      String   // "BUY" | "SELL"
  quantity  Float
  price     Float
  total     Float
  reason    String   // AI 交易理由
  createdAt DateTime @default(now())
}
```

**Step 5: 编写启停脚本**

`scripts/dev.sh`:
```bash
#!/bin/bash
set -e
cd "$(dirname "$0")/.."
mkdir -p logs
npx next dev 2>&1 | tee logs/dev.log
```

`scripts/build.sh`:
```bash
#!/bin/bash
set -e
cd "$(dirname "$0")/.."
npx next build 2>&1 | tee logs/build.log
```

`scripts/db-push.sh`:
```bash
#!/bin/bash
set -e
cd "$(dirname "$0")/.."
npx prisma db push
npx prisma generate
```

```bash
chmod +x scripts/*.sh
```

**Step 6: 更新 .gitignore**

追加以下内容：
```
.secondme/
.env.local
logs/
prisma/dev.db
prisma/dev.db-journal
```

**Step 7: 推送数据库并验证**

```bash
./scripts/db-push.sh
```

Expected: Prisma 成功创建 SQLite 数据库。

**Step 8: 启动开发服务器验证**

```bash
./scripts/dev.sh
```

Expected: Next.js 在 localhost:3000 启动成功。

**Step 9: Commit**

```bash
git init
git add -A
git commit -m "feat: 初始化 Next.js 项目，配置 Prisma + SQLite + SecondMe 环境变量"
```

---

## Task 2: 类型定义与工具库

**Files:**
- Create: `src/types/index.ts`
- Create: `src/lib/prisma.ts`
- Create: `src/lib/binance.ts`
- Create: `src/lib/secondme.ts`
- Create: `src/lib/auth.ts`

**Step 1: 创建全局类型定义**

`src/types/index.ts`:
```typescript
// Binance 行情数据
export interface CoinTicker {
  symbol: string;        // 如 "BTCUSDT"
  name: string;          // 如 "BTC"
  price: number;         // 当前价格
  priceChange: number;   // 24h 价格变化
  priceChangePercent: number; // 24h 涨跌幅
  high24h: number;       // 24h 最高价
  low24h: number;        // 24h 最低价
  volume: number;        // 24h 交易量
  quoteVolume: number;   // 24h 交易额 (USDT)
}

// 排行榜条目
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  totalAssets: number;    // 总资产 (现金 + 持仓市值)
  profitLoss: number;     // 盈亏金额
  profitLossPercent: number; // 盈亏百分比
  holdingsCount: number;  // 持有币种数
}

// 持仓信息
export interface HoldingInfo {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

// 交易记录
export interface TradeRecord {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  total: number;
  reason: string;
  createdAt: string;
}

// AI 交易决策 (Act API 输出)
export interface TradeDecision {
  action: "BUY" | "SELL" | "HOLD";
  symbol: string;
  percentage: number;  // 使用可用资金/持仓的百分比 (0-100)
  reason: string;
}

// SecondMe 用户信息
export interface SecondMeUser {
  userId: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
}

// SecondMe Token
export interface SecondMeToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// 用户 Session (JWT payload)
export interface UserSession {
  userId: string;
  name: string;
  avatar: string | null;
}
```

**Step 2: 创建 Prisma 客户端**

`src/lib/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Step 3: 创建 Binance API 封装**

`src/lib/binance.ts`:
```typescript
import { CoinTicker } from "@/types";

const BASE_URL = process.env.BINANCE_API_BASE || "https://api.binance.com";

// 热门 USDT 交易对（按市值/热度预选，避免获取全部数据）
const TOP_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
  "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT",
];

interface BinanceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

export async function getTopCoins(): Promise<CoinTicker[]> {
  const symbols = JSON.stringify(TOP_SYMBOLS);
  const url = `${BASE_URL}/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbols)}`;

  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);

  const data: BinanceTicker[] = await res.json();

  return data
    .map((t) => ({
      symbol: t.symbol,
      name: t.symbol.replace("USDT", ""),
      price: parseFloat(t.lastPrice),
      priceChange: parseFloat(t.priceChange),
      priceChangePercent: parseFloat(t.priceChangePercent),
      high24h: parseFloat(t.highPrice),
      low24h: parseFloat(t.lowPrice),
      volume: parseFloat(t.volume),
      quoteVolume: parseFloat(t.quoteVolume),
    }))
    .sort((a, b) => b.quoteVolume - a.quoteVolume);
}

export async function getCoinPrice(symbol: string): Promise<number> {
  const url = `${BASE_URL}/api/v3/ticker/price?symbol=${symbol}`;
  const res = await fetch(url, { next: { revalidate: 10 } });
  if (!res.ok) throw new Error(`Binance price error: ${res.status}`);
  const data = await res.json();
  return parseFloat(data.price);
}

export async function getCoinPrices(
  symbols: string[]
): Promise<Record<string, number>> {
  const symbolsParam = JSON.stringify(symbols);
  const url = `${BASE_URL}/api/v3/ticker/price?symbols=${encodeURIComponent(symbolsParam)}`;
  const res = await fetch(url, { next: { revalidate: 10 } });
  if (!res.ok) throw new Error(`Binance prices error: ${res.status}`);
  const data: { symbol: string; price: string }[] = await res.json();

  const prices: Record<string, number> = {};
  for (const item of data) {
    prices[item.symbol] = parseFloat(item.price);
  }
  return prices;
}
```

**Step 4: 创建 SecondMe API 封装**

`src/lib/secondme.ts`:
```typescript
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

  // 解析 SSE 流
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
        // 跳过非 JSON 行
      }
    }
  }

  try {
    return JSON.parse(content) as TradeDecision[];
  } catch {
    return [{ action: "HOLD", symbol: "BTCUSDT", percentage: 0, reason: "AI 返回格式异常，暂不操作" }];
  }
}
```

**Step 5: 创建认证工具**

`src/lib/auth.ts`:
```typescript
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { UserSession } from "@/types";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret-key-change-me");
const COOKIE_NAME = "session";

export async function createSession(payload: UserSession): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 天
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: 添加类型定义、Prisma 客户端、Binance/SecondMe/Auth 工具库"
```

---

## Task 3: OAuth 认证流程

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/callback/route.ts`
- Create: `src/app/login/page.tsx`

**Step 1: 创建登录发起端点**

`src/app/api/auth/login/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/secondme";

export async function GET() {
  const state = crypto.randomUUID();
  const url = getAuthorizationUrl(state);
  return NextResponse.redirect(url);
}
```

**Step 2: 创建 OAuth 回调端点**

`src/app/api/auth/callback/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getUserInfo } from "@/lib/secondme";
import { createSession, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
  }

  try {
    // 1. 用授权码换 Token
    const token = await exchangeCodeForToken(code);

    // 2. 获取用户信息
    const userInfo = await getUserInfo(token.accessToken);

    // 3. 创建或更新用户
    const user = await prisma.user.upsert({
      where: { secondmeUserId: userInfo.userId },
      update: {
        name: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.avatar,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000),
      },
      create: {
        secondmeUserId: userInfo.userId,
        name: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.avatar,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000),
        portfolio: {
          create: {
            cashBalance: parseFloat(process.env.INITIAL_FUND || "100000"),
          },
        },
      },
    });

    // 4. 创建 Session Cookie
    const jwt = await createSession({
      userId: user.id,
      name: user.name,
      avatar: user.avatar,
    });
    await setSessionCookie(jwt);

    return NextResponse.redirect(`${appUrl}/dashboard`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
  }
}
```

**Step 3: 创建登录页面**

`src/app/login/page.tsx`:
```typescript
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="max-w-md w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            SecondMe Binance
          </h1>
          <p className="text-gray-400">
            AI 虚拟炒币竞技平台
          </p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-6 text-sm">
            登录失败，请重试
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-300 text-sm mb-6">
            使用 SecondMe 账号登录，你的 AI 分身将获得
            <span className="text-emerald-400 font-bold"> $100,000 </span>
            虚拟资金，自动交易虚拟货币。
          </p>

          <a
            href="/api/auth/login"
            className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-4 rounded-lg text-center transition-colors"
          >
            使用 SecondMe 登录
          </a>
        </div>

        <p className="text-gray-600 text-xs text-center mt-4">
          登录即表示你同意参与 AI 虚拟交易竞技
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <LoginContent />
    </Suspense>
  );
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: 实现 SecondMe OAuth2 登录流程（登录页 + 回调处理）"
```

---

## Task 4: 全局布局与深色主题

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/layout/Header.tsx`

**Step 1: 更新全局样式**

`src/app/globals.css`:
```css
@import "tailwindcss";

:root {
  --bg-primary: #0a0e17;
  --bg-secondary: #111827;
  --bg-card: #1a1f2e;
  --border-color: #1f2937;
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --accent-green: #10b981;
  --accent-red: #ef4444;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
```

**Step 2: 创建 Header 组件**

`src/components/layout/Header.tsx`:
```typescript
import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function Header() {
  const session = await getSession();

  return (
    <header className="bg-gray-900/80 backdrop-blur border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-white">
          SecondMe Binance
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-gray-300 hover:text-white transition-colors">
            排行榜
          </Link>
          <Link href="/market" className="text-gray-300 hover:text-white transition-colors">
            行情
          </Link>
          {session ? (
            <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors">
              {session.name}
            </Link>
          ) : (
            <Link
              href="/login"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
```

**Step 3: 更新 Layout**

`src/app/layout.tsx`:
```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "@/components/layout/Header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SecondMe Binance - AI 虚拟炒币竞技平台",
  description: "让你的 AI 分身自动交易虚拟货币，和其他 AI 一较高下",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: 深色科技风全局布局和导航栏"
```

---

## Task 5: 行情数据 API 与页面

**Files:**
- Create: `src/app/api/market/route.ts`
- Create: `src/components/market/PriceTable.tsx`
- Create: `src/app/market/page.tsx`

**Step 1: 创建行情 API 路由**

`src/app/api/market/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getTopCoins } from "@/lib/binance";

export async function GET() {
  try {
    const coins = await getTopCoins();
    return NextResponse.json({ code: 0, data: coins });
  } catch (err) {
    console.error("Market API error:", err);
    return NextResponse.json({ code: 500, message: "获取行情失败" }, { status: 500 });
  }
}
```

**Step 2: 创建价格表格组件**

`src/components/market/PriceTable.tsx`:
```typescript
"use client";

import { CoinTicker } from "@/types";
import { useEffect, useState } from "react";

function formatPrice(price: number): string {
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toPrecision(4);
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
  return vol.toLocaleString();
}

export default function PriceTable() {
  const [coins, setCoins] = useState<CoinTicker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/market");
        const json = await res.json();
        if (json.code === 0) setCoins(json.data);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const timer = setInterval(fetchData, 30000); // 每 30 秒刷新
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return <div className="text-gray-500 text-center py-12">加载行情数据...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800">
            <th className="text-left py-3 px-2">#</th>
            <th className="text-left py-3 px-2">币种</th>
            <th className="text-right py-3 px-2">价格 (USDT)</th>
            <th className="text-right py-3 px-2">24h 涨跌</th>
            <th className="text-right py-3 px-2">24h 最高</th>
            <th className="text-right py-3 px-2">24h 最低</th>
            <th className="text-right py-3 px-2">24h 交易额</th>
          </tr>
        </thead>
        <tbody>
          {coins.map((coin, i) => (
            <tr key={coin.symbol} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              <td className="py-3 px-2 text-gray-500">{i + 1}</td>
              <td className="py-3 px-2 font-medium text-white">{coin.name}</td>
              <td className="py-3 px-2 text-right font-mono">${formatPrice(coin.price)}</td>
              <td className={`py-3 px-2 text-right font-mono ${coin.priceChangePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {coin.priceChangePercent >= 0 ? "+" : ""}{coin.priceChangePercent.toFixed(2)}%
              </td>
              <td className="py-3 px-2 text-right font-mono text-gray-400">${formatPrice(coin.high24h)}</td>
              <td className="py-3 px-2 text-right font-mono text-gray-400">${formatPrice(coin.low24h)}</td>
              <td className="py-3 px-2 text-right font-mono text-gray-400">${formatVolume(coin.quoteVolume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 3: 创建行情页面**

`src/app/market/page.tsx`:
```typescript
import PriceTable from "@/components/market/PriceTable";

export default function MarketPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">实时行情</h1>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <PriceTable />
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: 行情数据 API 和行情页面（Binance 实时数据 + 自动刷新）"
```

---

## Task 6: 排行榜 API 与首页

**Files:**
- Create: `src/app/api/leaderboard/route.ts`
- Create: `src/components/leaderboard/LeaderboardTable.tsx`
- Modify: `src/app/page.tsx`

**Step 1: 创建排行榜 API**

`src/app/api/leaderboard/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";
import { LeaderboardEntry } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        portfolio: { include: { holdings: true } },
      },
    });

    // 收集所有持仓的币种
    const allSymbols = new Set<string>();
    for (const user of users) {
      for (const h of user.portfolio?.holdings || []) {
        allSymbols.add(h.symbol);
      }
    }

    // 批量获取价格
    const prices = allSymbols.size > 0
      ? await getCoinPrices([...allSymbols])
      : {};

    const initialFund = parseFloat(process.env.INITIAL_FUND || "100000");

    // 计算每个用户的总资产
    const entries: LeaderboardEntry[] = users.map((user) => {
      const cash = user.portfolio?.cashBalance || 0;
      let holdingsValue = 0;

      for (const h of user.portfolio?.holdings || []) {
        holdingsValue += h.quantity * (prices[h.symbol] || 0);
      }

      const totalAssets = cash + holdingsValue;
      const profitLoss = totalAssets - initialFund;
      const profitLossPercent = (profitLoss / initialFund) * 100;

      return {
        rank: 0,
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        totalAssets,
        profitLoss,
        profitLossPercent,
        holdingsCount: user.portfolio?.holdings.length || 0,
      };
    });

    // 按总资产排序
    entries.sort((a, b) => b.totalAssets - a.totalAssets);
    entries.forEach((e, i) => (e.rank = i + 1));

    return NextResponse.json({ code: 0, data: entries });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json({ code: 500, message: "获取排行榜失败" }, { status: 500 });
  }
}
```

**Step 2: 创建排行榜组件**

`src/components/leaderboard/LeaderboardTable.tsx`:
```typescript
"use client";

import { LeaderboardEntry } from "@/types";
import Link from "next/link";
import { useEffect, useState } from "react";

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LeaderboardTable() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/leaderboard");
        const json = await res.json();
        if (json.code === 0) setEntries(json.data);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return <div className="text-gray-500 text-center py-12">加载排行榜...</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="text-gray-500 text-center py-12">
        暂无参赛者，快来登录参与吧！
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800">
            <th className="text-left py-3 px-2">排名</th>
            <th className="text-left py-3 px-2">AI 交易员</th>
            <th className="text-right py-3 px-2">总资产</th>
            <th className="text-right py-3 px-2">盈亏</th>
            <th className="text-right py-3 px-2">收益率</th>
            <th className="text-right py-3 px-2">持仓数</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.userId} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              <td className="py-3 px-2">
                <span className={`font-bold ${
                  entry.rank === 1 ? "text-yellow-400" :
                  entry.rank === 2 ? "text-gray-300" :
                  entry.rank === 3 ? "text-amber-600" : "text-gray-500"
                }`}>
                  #{entry.rank}
                </span>
              </td>
              <td className="py-3 px-2">
                <Link href={`/trader/${entry.userId}`} className="flex items-center gap-2 hover:text-emerald-400 transition-colors">
                  {entry.avatar ? (
                    <img src={entry.avatar} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-700" />
                  )}
                  <span className="font-medium">{entry.name}</span>
                </Link>
              </td>
              <td className="py-3 px-2 text-right font-mono">${formatMoney(entry.totalAssets)}</td>
              <td className={`py-3 px-2 text-right font-mono ${entry.profitLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {entry.profitLoss >= 0 ? "+" : ""}${formatMoney(entry.profitLoss)}
              </td>
              <td className={`py-3 px-2 text-right font-mono ${entry.profitLossPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {entry.profitLossPercent >= 0 ? "+" : ""}{entry.profitLossPercent.toFixed(2)}%
              </td>
              <td className="py-3 px-2 text-right text-gray-400">{entry.holdingsCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 3: 更新首页**

`src/app/page.tsx`:
```typescript
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";

export default function HomePage() {
  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">AI 虚拟炒币竞技场</h1>
        <p className="text-gray-400">
          每个 AI 分身拥有 $100,000 虚拟资金，每小时自动交易，看谁赚得最多
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-4">资金排行榜</h2>
        <LeaderboardTable />
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: 排行榜 API 和首页（实时资产排名 + 盈亏展示）"
```

---

## Task 7: 交易引擎

**Files:**
- Create: `src/lib/trading.ts`
- Create: `src/app/api/cron/trade/route.ts`

**Step 1: 创建交易引擎**

`src/lib/trading.ts`:
```typescript
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

  // 刷新 Token（如果快过期）
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

  // 获取行情数据
  const coins = await getTopCoins();
  const holdingsInfo = user.portfolio.holdings
    .map((h) => `${h.symbol}: 持有 ${h.quantity} 个, 均价 $${h.avgCost.toFixed(2)}`)
    .join("; ");

  const marketSummary = `当前时间: ${new Date().toISOString()}
可用现金: $${user.portfolio.cashBalance.toFixed(2)}
当前持仓: ${holdingsInfo || "无"}
市场行情:
${coins.map((c) => `${c.name}: $${c.price} (24h ${c.priceChangePercent >= 0 ? "+" : ""}${c.priceChangePercent.toFixed(2)}%, 成交额 $${(c.quoteVolume / 1e6).toFixed(0)}M)`).join("\n")}`;

  // 获取 AI 交易决策
  let decisions: TradeDecision[];
  try {
    decisions = await getTradeDecision(accessToken, marketSummary);
  } catch (err) {
    console.error(`Trade decision failed for user ${userId}:`, err);
    return;
  }

  // 执行交易
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
    if (spendAmount < 1) return; // 最小交易额
    const quantity = spendAmount / price;

    const existingHolding = portfolio.holdings.find(
      (h) => h.symbol === decision.symbol
    );

    await prisma.$transaction([
      // 扣减现金
      prisma.portfolio.update({
        where: { id: portfolioId },
        data: { cashBalance: { decrement: spendAmount } },
      }),
      // 更新持仓
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
      // 记录交易
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
      // 增加现金
      prisma.portfolio.update({
        where: { id: portfolioId },
        data: { cashBalance: { increment: revenue } },
      }),
      // 更新持仓
      remainingQty <= 0.00001
        ? prisma.holding.delete({ where: { id: holding.id } })
        : prisma.holding.update({
            where: { id: holding.id },
            data: { quantity: remainingQty },
          }),
      // 记录交易
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
```

**Step 2: 创建 Cron 触发端点**

`src/app/api/cron/trade/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { executeTradeForAllUsers } from "@/lib/trading";

export const maxDuration = 300; // 5 分钟超时

export async function GET(request: NextRequest) {
  // 验证 Cron Secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await executeTradeForAllUsers();
    return NextResponse.json({
      code: 0,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Cron trade error:", err);
    return NextResponse.json({ code: 500, message: "交易执行失败" }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: AI 交易引擎（Act API 决策 + 自动执行 + Cron 触发）"
```

---

## Task 8: 个人面板页面

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/components/trader/PortfolioChart.tsx`
- Create: `src/components/trader/TradeHistory.tsx`

**Step 1: 创建持仓展示组件**

`src/components/trader/PortfolioChart.tsx`:
```typescript
"use client";

import { HoldingInfo } from "@/types";

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  cashBalance: number;
  holdings: HoldingInfo[];
  totalAssets: number;
  profitLoss: number;
}

export default function PortfolioChart({ cashBalance, holdings, totalAssets, profitLoss }: Props) {
  const profitLossPercent = (profitLoss / 100000) * 100;

  return (
    <div className="space-y-6">
      {/* 资产概览 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-gray-500 text-xs mb-1">总资产</p>
          <p className="text-xl font-bold font-mono">${formatMoney(totalAssets)}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-gray-500 text-xs mb-1">盈亏</p>
          <p className={`text-xl font-bold font-mono ${profitLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {profitLoss >= 0 ? "+" : ""}${formatMoney(profitLoss)}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-gray-500 text-xs mb-1">收益率</p>
          <p className={`text-xl font-bold font-mono ${profitLossPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {profitLossPercent >= 0 ? "+" : ""}{profitLossPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* 现金余额 */}
      <div className="flex justify-between items-center text-sm px-1">
        <span className="text-gray-400">可用现金</span>
        <span className="font-mono">${formatMoney(cashBalance)}</span>
      </div>

      {/* 持仓列表 */}
      {holdings.length > 0 ? (
        <div className="space-y-2">
          {holdings.map((h) => (
            <div key={h.symbol} className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{h.symbol.replace("USDT", "")}</p>
                <p className="text-xs text-gray-500">
                  {h.quantity.toFixed(6)} 个 | 均价 ${formatMoney(h.avgCost)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono">${formatMoney(h.marketValue)}</p>
                <p className={`text-xs font-mono ${h.profitLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {h.profitLoss >= 0 ? "+" : ""}{h.profitLossPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center text-sm py-4">暂无持仓，等待 AI 下一次交易决策</p>
      )}
    </div>
  );
}
```

**Step 2: 创建交易历史组件**

`src/components/trader/TradeHistory.tsx`:
```typescript
"use client";

import { TradeRecord } from "@/types";

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  trades: TradeRecord[];
}

export default function TradeHistory({ trades }: Props) {
  if (trades.length === 0) {
    return <p className="text-gray-500 text-center text-sm py-8">暂无交易记录</p>;
  }

  return (
    <div className="space-y-3">
      {trades.map((trade) => (
        <div key={trade.id} className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                trade.side === "BUY"
                  ? "bg-emerald-900/50 text-emerald-400"
                  : "bg-red-900/50 text-red-400"
              }`}>
                {trade.side === "BUY" ? "买入" : "卖出"}
              </span>
              <span className="font-medium">{trade.symbol.replace("USDT", "")}</span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(trade.createdAt).toLocaleString("zh-CN")}
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>数量: {trade.quantity.toFixed(6)} | 价格: ${formatMoney(trade.price)}</span>
            <span className="font-mono">${formatMoney(trade.total)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {trade.reason}
          </p>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: 创建个人面板页面**

`src/app/dashboard/page.tsx`:
```typescript
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";
import { HoldingInfo } from "@/types";
import PortfolioChart from "@/components/trader/PortfolioChart";
import TradeHistory from "@/components/trader/TradeHistory";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      portfolio: { include: { holdings: true } },
      trades: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!user || !user.portfolio) redirect("/login");

  // 获取持仓的当前价格
  const symbols = user.portfolio.holdings.map((h) => h.symbol);
  const prices = symbols.length > 0 ? await getCoinPrices(symbols) : {};

  const holdings: HoldingInfo[] = user.portfolio.holdings.map((h) => {
    const currentPrice = prices[h.symbol] || 0;
    const marketValue = h.quantity * currentPrice;
    const costValue = h.quantity * h.avgCost;
    return {
      symbol: h.symbol,
      quantity: h.quantity,
      avgCost: h.avgCost,
      currentPrice,
      marketValue,
      profitLoss: marketValue - costValue,
      profitLossPercent: costValue > 0 ? ((marketValue - costValue) / costValue) * 100 : 0,
    };
  });

  const holdingsValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalAssets = user.portfolio.cashBalance + holdingsValue;
  const profitLoss = totalAssets - 100000;

  const trades = user.trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side as "BUY" | "SELL",
    quantity: t.quantity,
    price: t.price,
    total: t.total,
    reason: t.reason,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        {user.name} 的 AI 交易面板
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-4">持仓概览</h2>
          <PortfolioChart
            cashBalance={user.portfolio.cashBalance}
            holdings={holdings}
            totalAssets={totalAssets}
            profitLoss={profitLoss}
          />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-4">最近交易</h2>
          <TradeHistory trades={trades} />
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: 个人面板页面（持仓概览 + 交易历史）"
```

---

## Task 9: AI 详情页（查看他人交易）

**Files:**
- Create: `src/app/api/trader/[id]/route.ts`
- Create: `src/app/trader/[id]/page.tsx`

**Step 1: 创建 AI 详情 API**

`src/app/api/trader/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        portfolio: { include: { holdings: true } },
        trades: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });

    if (!user) {
      return NextResponse.json({ code: 404, message: "用户不存在" }, { status: 404 });
    }

    const symbols = user.portfolio?.holdings.map((h) => h.symbol) || [];
    const prices = symbols.length > 0 ? await getCoinPrices(symbols) : {};

    const holdings = (user.portfolio?.holdings || []).map((h) => {
      const currentPrice = prices[h.symbol] || 0;
      const marketValue = h.quantity * currentPrice;
      const costValue = h.quantity * h.avgCost;
      return {
        symbol: h.symbol,
        quantity: h.quantity,
        avgCost: h.avgCost,
        currentPrice,
        marketValue,
        profitLoss: marketValue - costValue,
        profitLossPercent: costValue > 0 ? ((marketValue - costValue) / costValue) * 100 : 0,
      };
    });

    const holdingsValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const cashBalance = user.portfolio?.cashBalance || 0;

    return NextResponse.json({
      code: 0,
      data: {
        name: user.name,
        avatar: user.avatar,
        cashBalance,
        totalAssets: cashBalance + holdingsValue,
        profitLoss: cashBalance + holdingsValue - 100000,
        holdings,
        trades: user.trades.map((t) => ({
          id: t.id,
          symbol: t.symbol,
          side: t.side,
          quantity: t.quantity,
          price: t.price,
          total: t.total,
          reason: t.reason,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error("Trader API error:", err);
    return NextResponse.json({ code: 500, message: "获取数据失败" }, { status: 500 });
  }
}
```

**Step 2: 创建 AI 详情页面**

`src/app/trader/[id]/page.tsx`:
```typescript
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCoinPrices } from "@/lib/binance";
import { HoldingInfo } from "@/types";
import PortfolioChart from "@/components/trader/PortfolioChart";
import TradeHistory from "@/components/trader/TradeHistory";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TraderPage({ params }: Props) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      portfolio: { include: { holdings: true } },
      trades: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });

  if (!user || !user.portfolio) notFound();

  const symbols = user.portfolio.holdings.map((h) => h.symbol);
  const prices = symbols.length > 0 ? await getCoinPrices(symbols) : {};

  const holdings: HoldingInfo[] = user.portfolio.holdings.map((h) => {
    const currentPrice = prices[h.symbol] || 0;
    const marketValue = h.quantity * currentPrice;
    const costValue = h.quantity * h.avgCost;
    return {
      symbol: h.symbol,
      quantity: h.quantity,
      avgCost: h.avgCost,
      currentPrice,
      marketValue,
      profitLoss: marketValue - costValue,
      profitLossPercent: costValue > 0 ? ((marketValue - costValue) / costValue) * 100 : 0,
    };
  });

  const holdingsValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalAssets = user.portfolio.cashBalance + holdingsValue;
  const profitLoss = totalAssets - 100000;

  const trades = user.trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side as "BUY" | "SELL",
    quantity: t.quantity,
    price: t.price,
    total: t.total,
    reason: t.reason,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-700" />
        )}
        <h1 className="text-2xl font-bold">{user.name} 的 AI 交易员</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-4">持仓概览</h2>
          <PortfolioChart
            cashBalance={user.portfolio.cashBalance}
            holdings={holdings}
            totalAssets={totalAssets}
            profitLoss={profitLoss}
          />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-4">交易记录</h2>
          <TradeHistory trades={trades} />
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: AI 详情页（查看任意用户的持仓和交易记录）"
```

---

## Task 10: 收尾与验证

**Files:**
- Modify: `CLAUDE.md`
- Modify: `.secondme/state.json` (stage → "ready")

**Step 1: 更新 CLAUDE.md**

更新项目说明，补充启动步骤和 Cron 配置。

**Step 2: 更新 state.json stage 为 "ready"**

**Step 3: 完整构建验证**

```bash
./scripts/db-push.sh
./scripts/build.sh
```

Expected: 构建成功无错误。

**Step 4: 启动并手动测试**

```bash
./scripts/dev.sh
```

验证清单：
- [ ] 访问 http://localhost:3000 看到排行榜首页
- [ ] 访问 http://localhost:3000/market 看到行情数据
- [ ] 访问 http://localhost:3000/login 看到登录页
- [ ] 点击登录跳转到 SecondMe 授权页
- [ ] 授权后回到 Dashboard 页面
- [ ] 手动触发交易：`curl -H "Authorization: Bearer your-cron-secret-key" http://localhost:3000/api/cron/trade`

**Step 5: Final Commit**

```bash
git add -A
git commit -m "feat: SecondMe Binance AI 虚拟炒币竞技平台 - 项目完成"
```

---

## 后续可选优化

1. **定时任务**：使用 Vercel Cron 或外部 cron 服务每小时调用 `/api/cron/trade`
2. **WebSocket 实时行情**：接入 Binance WebSocket API 推送实时价格
3. **交易历史图表**：使用 recharts 库展示资产变化曲线
4. **AI 对话功能**：集成 SecondMe Chat API，让用户和自己的 AI 讨论交易策略
