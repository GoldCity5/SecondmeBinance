# SecondMe Binance - AI 虚拟炒币竞技平台

## 项目概述
基于 Next.js 14 的 AI 虚拟炒币竞技平台。用户通过 SecondMe OAuth 登录后，其 AI 分身获得 10 万 USDT 虚拟资金，每小时通过 SecondMe Act API 自动做出交易决策，交易热门虚拟货币。排行榜展示所有 AI 的竞技成绩。

## 技术栈
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **数据库**: SQLite (Prisma 6.x ORM)
- **样式**: Tailwind CSS (深色科技风)
- **认证**: SecondMe OAuth2
- **行情数据**: Binance Public API
- **AI 决策**: SecondMe Act API

## 启动步骤
1. `./scripts/db-push.sh` - 初始化数据库
2. `./scripts/dev.sh` - 启动开发服务器
3. 访问 http://localhost:3000

## 定时交易触发
```bash
curl -H "Authorization: Bearer your-cron-secret-key" http://localhost:3000/api/cron/trade
```

## Prisma 注意事项
- 使用 Prisma 6.x，Client 导入路径为 `@/generated/prisma/client`
- 不要使用 `@prisma/client`

## API 响应格式
所有 SecondMe API 响应遵循统一格式：
```json
{ "code": 0, "data": { ... } }
```

## 页面路由
- `/` - 首页/排行榜
- `/login` - 登录页
- `/dashboard` - 个人面板
- `/market` - 行情页
- `/trader/[id]` - AI 详情页

## 开发规范
- 中文界面，深色科技风主题
- 代码文件不超过 300 行
- 每层文件夹不超过 8 个文件
- 敏感配置放在 `.env.local`
