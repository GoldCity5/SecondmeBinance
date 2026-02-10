"use client";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  positive: boolean;
}

export default function Sparkline({ data, width = 120, height = 40, positive }: Props) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="bg-gray-800/30 rounded" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const color = positive ? "#10b981" : "#ef4444";

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}
