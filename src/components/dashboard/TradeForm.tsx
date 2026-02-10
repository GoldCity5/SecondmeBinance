"use client";

import { useState, useEffect } from "react";
import { CoinTicker } from "@/types";

const PERCENTAGES = [25, 50, 75, 100];
const LEVERAGES = [1, 2, 3, 5, 10];

export default function TradeForm() {
  const [coins, setCoins] = useState<CoinTicker[]>([]);
  const [symbol, setSymbol] = useState("");
  const [action, setAction] = useState<"BUY" | "SELL">("BUY");
  const [percentage, setPercentage] = useState(25);
  const [leverage, setLeverage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function fetchCoins() {
      try {
        const res = await fetch("/api/market");
        const json = await res.json();
        if (json.code === 0 && json.data.length > 0) {
          setCoins(json.data);
          setSymbol(json.data[0].symbol);
        }
      } catch {
        // 静默处理
      }
    }
    fetchCoins();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol || submitting) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/trade/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, action, percentage, leverage }),
      });
      const json = await res.json();

      if (json.code === 0) {
        const msg = json.data.liquidated
          ? "交易执行成功，但账户已触发爆仓！"
          : "交易执行成功！";
        setMessage({ type: json.data.liquidated ? "error" : "success", text: msg });
        // 延迟刷新页面
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMessage({ type: "error", text: json.message || "交易失败" });
      }
    } catch {
      setMessage({ type: "error", text: "网络错误" });
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCoin = coins.find((c) => c.symbol === symbol);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 选择币种 */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">选择币种</label>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 outline-none"
        >
          {coins.map((c) => (
            <option key={c.symbol} value={c.symbol}>
              {c.name} (${c.price.toLocaleString()})
            </option>
          ))}
        </select>
        {selectedCoin && (
          <p className={`text-xs mt-1 ${selectedCoin.priceChangePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            24h: {selectedCoin.priceChangePercent >= 0 ? "+" : ""}{selectedCoin.priceChangePercent.toFixed(2)}%
          </p>
        )}
      </div>

      {/* 买/卖方向 */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">方向</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAction("BUY")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              action === "BUY"
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            买入
          </button>
          <button
            type="button"
            onClick={() => setAction("SELL")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              action === "SELL"
                ? "bg-red-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            卖出
          </button>
        </div>
      </div>

      {/* 百分比 */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">
          {action === "BUY" ? "投入资金比例" : "卖出持仓比例"}
        </label>
        <div className="flex gap-2">
          {PERCENTAGES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPercentage(p)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                percentage === p
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {/* 杠杆 */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">杠杆倍数</label>
        <div className="flex gap-2">
          {LEVERAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLeverage(l)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                leverage === l
                  ? "bg-amber-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {l}x
            </button>
          ))}
        </div>
      </div>

      {/* 提交 */}
      <button
        type="submit"
        disabled={submitting || !symbol}
        className={`w-full py-3 rounded-lg font-medium transition ${
          action === "BUY"
            ? "bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800"
            : "bg-red-600 hover:bg-red-500 disabled:bg-red-800"
        } disabled:opacity-50`}
      >
        {submitting
          ? "执行中..."
          : `${action === "BUY" ? "买入" : "卖出"} ${symbol.replace("USDT", "")} ${percentage}% ${leverage > 1 ? `(${leverage}x杠杆)` : ""}`}
      </button>

      {/* 结果提示 */}
      {message && (
        <p className={`text-sm text-center ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
