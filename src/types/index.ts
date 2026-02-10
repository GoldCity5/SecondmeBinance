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
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  totalAssets: number;
  profitLoss: number;
  profitLossPercent: number;
  holdingsCount: number;
}

export interface HoldingInfo {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

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

export interface TradeDecision {
  action: "BUY" | "SELL" | "HOLD";
  symbol: string;
  percentage: number;
  reason: string;
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
