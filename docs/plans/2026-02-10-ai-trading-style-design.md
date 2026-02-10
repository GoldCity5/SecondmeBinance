# AI 交易流派与内心独白 — 设计方案

## 背景

当前所有 AI 交易员使用同一套逻辑，缺乏个性差异。用户看到的只是冷冰冰的数据，缺少代入感和娱乐性。

## 核心目标

让每个 AI 交易员拥有鲜明的"性格"，通过交易风格差异和实时内心独白，把交易数据变成有趣的角色扮演体验。

## 设计决策

| 决策点 | 方案 | 理由 |
|--------|------|------|
| 流派与用户关系 | 混合：系统推荐 + 用户可切换 | 兼顾智能感和自主权 |
| 独白生成方式 | 交易时 AI 顺带生成 | 改动最小，每小时更新频率合理 |
| 流派扩展性 | 4 个固定流派，硬编码 | 先验证方向，YAGNI |

## 流派定义

| ID | 名称 | Emoji | 风险偏好 | 标的限制 | 仓位特征 |
|----|------|-------|---------|---------|---------|
| `yolo-king` | 梭哈之王 | 🔥 | 极高 | 高波动山寨币 | 单次 50-80% |
| `zen-monk` | 定投老僧 | 🧘 | 极低 | 仅 BTC/ETH | 单次最多 20% |
| `news-hawk` | 消息面大师 | 📡 | 中高 | 不限 | 快进快出 |
| `contrarian` | 反向指标 | 🔄 | 高 | 不限 | 逆势操作 |

## 数据模型变更

- `User` 新增 `tradingStyle String @default("")`
- `Trade` 新增 `monologue String @default("")`

## Prompt 改造

1. 在交易 prompt 前注入流派人设描述
2. 返回结构新增 `monologue` 字段（20 字以内的内心独白）
3. 首次交易时根据 SecondMe shades/memories 自动匹配流派

## 前端展示

1. Dashboard / Trader 详情页新增"内心独白"卡片（流派标识 + 最新独白 + 切换按钮）
2. 排行榜每行加流派标签
3. 交易记录每条加独白显示

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `prisma/schema.prisma` | 修改 |
| `src/lib/styles.ts` | 新增 |
| `src/types/index.ts` | 修改 |
| `src/lib/secondme.ts` | 修改 |
| `src/lib/trading.ts` | 修改 |
| `src/app/api/user/style/route.ts` | 新增 |
| `src/components/trader/AiMonologue.tsx` | 新增 |
| `src/components/trader/StyleSwitcher.tsx` | 新增 |
| `src/components/trader/TradeHistory.tsx` | 修改 |
| `src/components/leaderboard/LeaderboardTable.tsx` | 修改 |
| `src/app/dashboard/page.tsx` | 修改 |
| `src/app/trader/[id]/page.tsx` | 修改 |

## 实现顺序

1. 数据层：Schema + 类型 + 流派常量
2. 核心逻辑：Prompt 改造 + 流派匹配 + monologue 存储
3. API：切换流派接口
4. 前端：独白卡片 → 排行榜标签 → 交易记录独白
