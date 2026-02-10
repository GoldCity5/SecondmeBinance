"use client";

import { useEffect, useState, useCallback } from "react";
import { SnapshotPeriod, SnapshotPoint } from "@/types";

const PERIODS: { label: string; value: SnapshotPeriod }[] = [
  { label: "1天", value: "1D" },
  { label: "1周", value: "1W" },
  { label: "1月", value: "1M" },
  { label: "3月", value: "3M" },
  { label: "全部", value: "ALL" },
];

const INITIAL_CAPITAL = 100000;
const SVG_WIDTH = 600;
const SVG_HEIGHT = 200;
const PADDING = { top: 20, right: 16, bottom: 30, left: 60 };

const chartW = SVG_WIDTH - PADDING.left - PADDING.right;
const chartH = SVG_HEIGHT - PADDING.top - PADDING.bottom;

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(d: string): string {
  return d.slice(5); // "MM-DD"
}

interface Props {
  userId: string;
}

export default function EquityCurve({ userId }: Props) {
  const [period, setPeriod] = useState<SnapshotPeriod>("1W");
  const [data, setData] = useState<SnapshotPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/portfolio/history?userId=${userId}&period=${period}`
      );
      const json = await res.json();
      if (json.code === 0) setData(json.data);
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
    }
  }, [userId, period]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const profitPercent =
    data.length >= 2
      ? ((data[data.length - 1].totalAssets - data[0].totalAssets) /
          data[0].totalAssets) *
        100
      : 0;

  const isPositive = data.length > 0
    ? data[data.length - 1].totalAssets >= INITIAL_CAPITAL
    : true;

  const strokeColor = isPositive ? "#34d399" : "#f87171";
  const fillColor = isPositive
    ? "rgba(52, 211, 153, 0.15)"
    : "rgba(248, 113, 113, 0.15)";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">收益曲线</h2>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                period === p.value
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
          加载中...
        </div>
      ) : data.length < 2 ? (
        <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
          暂无足够数据，等待交易产生快照
        </div>
      ) : (
        <>
          <ChartSummary data={data} profitPercent={profitPercent} isPositive={isPositive} />
          <ChartSVG
            data={data}
            strokeColor={strokeColor}
            fillColor={fillColor}
          />
        </>
      )}
    </div>
  );
}

function ChartSummary({
  data,
  profitPercent,
  isPositive,
}: {
  data: SnapshotPoint[];
  profitPercent: number;
  isPositive: boolean;
}) {
  const latest = data[data.length - 1];
  const highest = Math.max(...data.map((d) => d.totalAssets));
  const lowest = Math.min(...data.map((d) => d.totalAssets));

  return (
    <div className="grid grid-cols-4 gap-3 mb-3 text-xs">
      <div>
        <span className="text-gray-500">当前</span>
        <p className="font-mono">${formatMoney(latest.totalAssets)}</p>
      </div>
      <div>
        <span className="text-gray-500">区间收益</span>
        <p className={`font-mono ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
          {profitPercent >= 0 ? "+" : ""}
          {profitPercent.toFixed(2)}%
        </p>
      </div>
      <div>
        <span className="text-gray-500">最高</span>
        <p className="font-mono">${formatMoney(highest)}</p>
      </div>
      <div>
        <span className="text-gray-500">最低</span>
        <p className="font-mono">${formatMoney(lowest)}</p>
      </div>
    </div>
  );
}

function ChartSVG({
  data,
  strokeColor,
  fillColor,
}: {
  data: SnapshotPoint[];
  strokeColor: string;
  fillColor: string;
}) {
  const values = data.map((d) => d.totalAssets);
  const minVal = Math.min(...values) * 0.998;
  const maxVal = Math.max(...values) * 1.002;
  const range = maxVal - minVal || 1;

  const toX = (i: number) =>
    PADDING.left + (i / (data.length - 1)) * chartW;
  const toY = (v: number) =>
    PADDING.top + (1 - (v - minVal) / range) * chartH;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(d.totalAssets).toFixed(1)}`)
    .join(" ");

  const areaPath =
    linePath +
    ` L ${toX(data.length - 1).toFixed(1)} ${(PADDING.top + chartH).toFixed(1)}` +
    ` L ${PADDING.left.toFixed(1)} ${(PADDING.top + chartH).toFixed(1)} Z`;

  // Y 轴刻度 (4 条)
  const yTicks = Array.from({ length: 4 }, (_, i) => {
    const val = minVal + (range * (3 - i)) / 3;
    return { val, y: toY(val) };
  });

  // X 轴标签 (最多 5 个)
  const xLabelCount = Math.min(5, data.length);
  const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
    const idx =
      xLabelCount === 1
        ? 0
        : Math.round((i / (xLabelCount - 1)) * (data.length - 1));
    return { label: formatDate(data[idx].date), x: toX(idx) };
  });

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 网格线 */}
      {yTicks.map((t, i) => (
        <line
          key={i}
          x1={PADDING.left}
          x2={SVG_WIDTH - PADDING.right}
          y1={t.y}
          y2={t.y}
          stroke="#1f2937"
          strokeWidth={1}
        />
      ))}

      {/* Y 轴标签 */}
      {yTicks.map((t, i) => (
        <text
          key={i}
          x={PADDING.left - 6}
          y={t.y + 4}
          textAnchor="end"
          fill="#6b7280"
          fontSize={10}
        >
          {t.val >= 1000 ? `${(t.val / 1000).toFixed(1)}K` : t.val.toFixed(0)}
        </text>
      ))}

      {/* X 轴标签 */}
      {xLabels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={SVG_HEIGHT - 6}
          textAnchor="middle"
          fill="#6b7280"
          fontSize={10}
        >
          {l.label}
        </text>
      ))}

      {/* 填充区域 */}
      <path d={areaPath} fill={fillColor} />

      {/* 折线 */}
      <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={2} />

      {/* 起止圆点 */}
      <circle cx={toX(0)} cy={toY(data[0].totalAssets)} r={3} fill={strokeColor} />
      <circle
        cx={toX(data.length - 1)}
        cy={toY(data[data.length - 1].totalAssets)}
        r={3}
        fill={strokeColor}
      />
    </svg>
  );
}
