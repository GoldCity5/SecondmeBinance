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
  customPersona: string;
  onSwitch: (styleId: string, customPersona: string) => void;
}

export default function StyleSwitcher({ currentStyle, customPersona: initPersona, onSwitch }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(initPersona);
  const isCustom = initPersona.length > 0;

  async function handleSelectPreset(styleId: string) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/style", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId }),
      });
      const json = await res.json();
      if (json.code === 0) {
        setDraft("");
        onSwitch(styleId, "");
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCustom() {
    if (saving || !draft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/style", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPersona: draft.trim() }),
      });
      const json = await res.json();
      if (json.code === 0) {
        onSwitch(currentStyle, json.data.customPersona);
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleClearCustom() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/style", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPersona: "" }),
      });
      const json = await res.json();
      if (json.code === 0) {
        setDraft("");
        onSwitch(currentStyle, "");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-400 hover:text-cyan-400 transition px-2 py-1 rounded border border-gray-700 hover:border-cyan-600"
      >
        {isCustom ? "编辑人设" : "切换流派"}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-10 bg-gray-800 border border-gray-700 rounded-lg p-3 w-72 shadow-xl">
          {/* 自定义人设 */}
          <p className="text-xs text-gray-500 mb-1">自定义交易人设</p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="描述你想要的交易风格，如：只在大跌时抄底，永远不追高，说话像个老江湖..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-200 placeholder-gray-600 resize-none focus:border-cyan-600 focus:outline-none"
          />
          <div className="flex items-center justify-between mt-1 mb-3">
            <span className="text-xs text-gray-600">{draft.length}/200</span>
            <div className="flex gap-2">
              {isCustom && (
                <button
                  onClick={handleClearCustom}
                  disabled={saving}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  清除
                </button>
              )}
              <button
                onClick={handleSaveCustom}
                disabled={saving || !draft.trim()}
                className="text-xs bg-cyan-600 text-white px-2 py-0.5 rounded hover:bg-cyan-500 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>

          {/* 预设流派 */}
          <p className="text-xs text-gray-500 mb-1 border-t border-gray-700 pt-2">或选择预设流派</p>
          <div className="space-y-1.5">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectPreset(s.id)}
                disabled={saving}
                className={`w-full text-left p-2 rounded-lg transition text-sm ${
                  !isCustom && s.id === currentStyle
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
