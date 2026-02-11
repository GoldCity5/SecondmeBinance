"use client";

import { useState, useEffect, useCallback } from "react";
import { KlineBar, KlineInterval, TradeMarker, CoinTicker } from "@/types";

const INTERVALS: { label: string; value: KlineInterval }[] = [
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
];

const SVG_W = 800;
const SVG_H = 400;
const PAD = { top: 20, right: 70, bottom: 30, left: 10 };
const CHART_W = SVG_W - PAD.left - PAD.right;
const CHART_H = SVG_H - PAD.top - PAD.bottom;

interface Props {
  symbol: string;
}

interface ChartData {
  ticker: CoinTicker;
  klines: KlineBar[];
  tradeMarkers: TradeMarker[];
}

export default function KlineChart({ symbol }: Props) {
  const [interval, setInterval_] = useState<KlineInterval>("1h");
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; bar: KlineBar } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/${symbol}?interval=${interval}`);
      const json = await res.json();
      if (json.code === 0) setData(json.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [symbol, interval]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const timer = window.setInterval(fetchData, 30000);
    return () => window.clearInterval(timer);
  }, [fetchData]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">K 线图</h2>
        <div className="flex gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setInterval_(iv.value)}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                interval === iv.value
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center text-gray-500 text-sm">
          加载中...
        </div>
      ) : !data || data.klines.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center text-gray-500 text-sm">
          暂无数据
        </div>
      ) : (
        <div className="relative">
          <CandlestickSVG
            klines={data.klines}
            markers={data.tradeMarkers}
            onHover={setTooltip}
          />
          {tooltip && <Tooltip x={tooltip.x} y={tooltip.y} bar={tooltip.bar} />}
          <MarkerLegend />
        </div>
      )}
    </div>
  );
}

function CandlestickSVG({
  klines,
  markers,
  onHover,
}: {
  klines: KlineBar[];
  markers: TradeMarker[];
  onHover: (t: { x: number; y: number; bar: KlineBar } | null) => void;
}) {
  const allHighs = klines.map((k) => k.high);
  const allLows = klines.map((k) => k.low);
  const minPrice = Math.min(...allLows) * 0.999;
  const maxPrice = Math.max(...allHighs) * 1.001;
  const priceRange = maxPrice - minPrice || 1;

  const barW = CHART_W / klines.length;
  const candleW = Math.max(2, barW * 0.6);

  const toX = (i: number) => PAD.left + i * barW + barW / 2;
  const toY = (price: number) => PAD.top + (1 - (price - minPrice) / priceRange) * CHART_H;

  // Y 轴刻度
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = minPrice + (priceRange * (4 - i)) / 4;
    return { val, y: toY(val) };
  });

  // X 轴标签（最多 6 个）
  const xCount = Math.min(6, klines.length);
  const xLabels = Array.from({ length: xCount }, (_, i) => {
    const idx = xCount === 1 ? 0 : Math.round((i / (xCount - 1)) * (klines.length - 1));
    const d = new Date(klines[idx].time);
    const label = d.getMonth() + 1 + "/" + d.getDate() + " " + d.getHours() + ":00";
    return { label, x: toX(idx) };
  });

  // K 线时间范围（用于匹配交易标记）
  const klineStart = klines[0]?.time || 0;
  const klineEnd = klines[klines.length - 1]?.time || 0;
  const klineDuration = klines.length > 1 ? klines[1].time - klines[0].time : 0;

  // 过滤在 K 线时间范围内的交易标记
  const visibleMarkers = markers.filter(
    (m) => m.time >= klineStart && m.time <= klineEnd + klineDuration
  );

  // 为每个 marker 找到最近的 K 线索引
  function findBarIndex(time: number): number {
    let closest = 0;
    let minDiff = Infinity;
    for (let i = 0; i < klines.length; i++) {
      const diff = Math.abs(klines[i].time - time);
      if (diff < minDiff) { minDiff = diff; closest = i; }
    }
    return closest;
  }

  function formatPrice(p: number): string {
    if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (p >= 1) return p.toFixed(2);
    return p.toPrecision(4);
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full h-auto"
      onMouseLeave={() => onHover(null)}
    >
      {/* 网格线 */}
      {yTicks.map((t, i) => (
        <line key={i} x1={PAD.left} x2={SVG_W - PAD.right} y1={t.y} y2={t.y} stroke="#1f2937" strokeWidth={1} />
      ))}

      {/* Y 轴标签 */}
      {yTicks.map((t, i) => (
        <text key={i} x={SVG_W - PAD.right + 6} y={t.y + 4} fill="#6b7280" fontSize={10}>
          ${formatPrice(t.val)}
        </text>
      ))}

      {/* X 轴标签 */}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={SVG_H - 6} textAnchor="middle" fill="#6b7280" fontSize={10}>
          {l.label}
        </text>
      ))}

      {/* 蜡烛 */}
      {klines.map((k, i) => {
        const x = toX(i);
        const isUp = k.close >= k.open;
        const color = isUp ? "#10b981" : "#ef4444";
        const bodyTop = toY(Math.max(k.open, k.close));
        const bodyBot = toY(Math.min(k.open, k.close));
        const bodyH = Math.max(1, bodyBot - bodyTop);

        return (
          <g key={i}
            onMouseEnter={(e) => {
              const rect = (e.target as SVGElement).closest("svg")?.getBoundingClientRect();
              if (rect) {
                onHover({
                  x: (x / SVG_W) * rect.width,
                  y: (toY(k.high) / SVG_H) * rect.height,
                  bar: k,
                });
              }
            }}
          >
            {/* 影线 */}
            <line x1={x} x2={x} y1={toY(k.high)} y2={toY(k.low)} stroke={color} strokeWidth={1} />
            {/* 实体 */}
            <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} rx={0.5} />
            {/* 透明热区 */}
            <rect x={x - barW / 2} y={PAD.top} width={barW} height={CHART_H} fill="transparent" />
          </g>
        );
      })}

      {/* 交易标记 */}
      {visibleMarkers.map((m, i) => {
        const barIdx = findBarIndex(m.time);
        const x = toX(barIdx);
        const y = toY(m.price);
        const isAi = m.type === "AI";
        const color = isAi ? "#3b82f6" : "#a855f7";
        const isBuy = m.side === "BUY";
        const offset = isBuy ? 10 : -10;

        return (
          <g key={`m-${i}`}>
            {isBuy ? (
              <polygon
                points={`${x},${y + offset - 8} ${x - 5},${y + offset} ${x + 5},${y + offset}`}
                fill={color}
                opacity={0.9}
              />
            ) : (
              <polygon
                points={`${x},${y + offset + 8} ${x - 5},${y + offset} ${x + 5},${y + offset}`}
                fill={color}
                opacity={0.9}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Tooltip({ x, y, bar }: { x: number; y: number; bar: KlineBar }) {
  const d = new Date(bar.time);
  const timeStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
  const isUp = bar.close >= bar.open;

  return (
    <div
      className="absolute bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs pointer-events-none z-10 shadow-lg"
      style={{ left: Math.min(x, 600), top: Math.max(0, y - 10) }}
    >
      <p className="text-gray-400 mb-1">{timeStr}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-gray-500">开:</span><span className="font-mono">${bar.open.toLocaleString()}</span>
        <span className="text-gray-500">高:</span><span className="font-mono">${bar.high.toLocaleString()}</span>
        <span className="text-gray-500">低:</span><span className="font-mono">${bar.low.toLocaleString()}</span>
        <span className="text-gray-500">收:</span>
        <span className={`font-mono ${isUp ? "text-emerald-400" : "text-red-400"}`}>
          ${bar.close.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function MarkerLegend() {
  return (
    <div className="flex gap-4 mt-3 text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <span className="inline-block w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-blue-500" />
        AI 买入
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-blue-500" />
        AI 卖出
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-purple-500" />
        真人买入
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-purple-500" />
        真人卖出
      </span>
    </div>
  );
}
