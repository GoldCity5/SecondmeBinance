# SecondMe Binance 项目

## 项目概述
基于 Next.js 的 SecondMe 集成网站，支持 OAuth 登录、个人信息展示、AI 对话和笔记功能。

## 技术栈
- **框架**: Next.js 14+ (App Router)
- **数据库**: SQLite (Prisma ORM)
- **样式**: Tailwind CSS
- **认证**: SecondMe OAuth2

## SecondMe API 配置
- **Base URL**: `https://app.mindos.com/gate/lab`
- **OAuth URL**: `https://go.second.me/oauth/`
- **已启用模块**: auth, profile, chat, note
- **配置文件**: `.secondme/state.json`

## API 响应格式
所有 SecondMe API 响应遵循统一格式：
```json
{ "code": 0, "data": { ... } }
```
前端必须从 `result.data` 中提取实际数据。

## 开发规范
- 中文界面，简约亮色主题
- 代码文件不超过 300 行
- 每层文件夹不超过 8 个文件
- 使用强类型定义
- 敏感配置放在 `.env.local`，不提交到 Git
