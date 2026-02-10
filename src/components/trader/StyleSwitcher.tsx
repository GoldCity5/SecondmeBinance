"use client";

import { useState } from "react";

interface StyleOption {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

const STYLES: StyleOption[] = [
  { id: "yolo-king", name: "梭哈之王", emoji: "\uD83D\uDD25", description: "风险极高，偏爱山寨币，满仓梭哈" },
  { id: "zen-monk", name: "定投老僧", emoji: "\uD83E\uDDD8", description: "极其稳健，只碰 BTC/ETH" },
  { id: "news-hawk", name: "消息面大师", emoji: "\uD83D\uDCE1", description: "紧盯消息面，快进快出" },
  { id: "contrarian", name: "反向指标", emoji: "\uD83D\uDD04", description: "逆势操作，大涨看空大跌看多" },
];

interface Props {
  currentStyle: string;
  onSwitch: (styleId: string) => void;
}

export default function StyleSwitcher({ currentStyle, onSwitch }: Props) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function handleSelect(styleId: string) {
    if (styleId === currentStyle || switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/user/style", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId }),
      });
      const json = await res.json();
      if (json.code === 0) {
        onSwitch(styleId);
        setOpen(false);
      }
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-400 hover:text-cyan-400 transition px-2 py-1 rounded border border-gray-700 hover:border-cyan-600"
      >
        切换流派
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-10 bg-gray-800 border border-gray-700 rounded-lg p-3 w-64 shadow-xl">
          <p className="text-xs text-gray-500 mb-2">选择交易流派</p>
          <div className="space-y-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelect(s.id)}
                disabled={switching}
                className={`w-full text-left p-2 rounded-lg transition text-sm ${
                  s.id === currentStyle
                    ? "bg-cyan-900/40 border border-cyan-700"
                    : "bg-gray-700/50 hover:bg-gray-700 border border-transparent"
                }`}
              >
                <span className="mr-1">{s.emoji}</span>
                <span className="font-medium">{s.name}</span>
                <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
