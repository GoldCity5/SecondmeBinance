// Portfolio 类型
export type PortfolioType = "AI" | "MANUAL";

// 真人交易请求
export interface ManualTradeRequest {
  symbol: string;
  action: "BUY" | "SELL";
  percentage: number; // 1-100
  leverage?: number;  // 1-10
}

// Binance 行情数据
export interface CoinTicker {
  symbol: string;
  name: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume: number;
  quoteVolume: number;
  kline?: number[]; // 最近 24h K 线收盘价
}

export interface LeaderboardHolding {
  symbol: string;
  leverage: number;
  profitLossPercent: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  tradingStyle: string;
  customPersona: string;
  totalAssets: number;
  profitLoss: number;
  profitLossPercent: number;
  holdingsCount: number;
  isLiquidated: boolean;
  holdings: LeaderboardHolding[];
  latestMonologue: string | null;
  type: PortfolioType;
}

export interface HoldingInfo {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  profitLoss: number;
  profitLossPercent: number;
  leverage: number;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  total: number;
  leverage: number;
  reason: string;
  monologue: string;
  createdAt: string;
}

export interface TradeDecision {
  action: "BUY" | "SELL" | "HOLD";
  symbol: string;
  percentage: number;
  leverage?: number;
  reason: string;
  monologue?: string;
}

export interface SecondMeUser {
  userId: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
}

export interface SecondMeToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserSession {
  userId: string;
  name: string;
  avatar: string | null;
}

// 收益快照
export interface SnapshotPoint {
  date: string;
  totalAssets: number;
  profitLoss: number;
}

export type SnapshotPeriod = "1D" | "1W" | "1M" | "3M" | "ALL";
