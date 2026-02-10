"use client";

import { useState } from "react";
import StyleSwitcher from "./StyleSwitcher";

const STYLE_INFO: Record<string, { name: string; emoji: string }> = {
  "yolo-king": { name: "梭哈之王", emoji: "\uD83D\uDD25" },
  "zen-monk": { name: "定投老僧", emoji: "\uD83E\uDDD8" },
  "news-hawk": { name: "消息面大师", emoji: "\uD83D\uDCE1" },
  "contrarian": { name: "反向指标", emoji: "\uD83D\uDD04" },
};

interface Props {
  tradingStyle: string;
  customPersona: string;
  monologue: string | null;
  monologueTime: string | null;
  editable?: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

export default function AiMonologue({ tradingStyle, customPersona: initCustom, monologue, monologueTime, editable }: Props) {
  const [style, setStyle] = useState(tradingStyle);
  const [custom, setCustom] = useState(initCustom);
  const isCustom = custom.length > 0;
  const info = STYLE_INFO[style] || { name: "未知", emoji: "\uD83E\uDD16" };

  function handleSwitch(newStyle: string, newCustom: string) {
    setStyle(newStyle);
    setCustom(newCustom);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isCustom ? (
            <>
              <span className="text-lg">{"\uD83C\uDFAD"}</span>
              <span className="font-semibold">自定义人设</span>
            </>
          ) : (
            <>
              <span className="text-lg">{info.emoji}</span>
              <span className="font-semibold">{info.name}</span>
            </>
          )}
          <span className="text-xs text-gray-500">· 内心独白</span>
        </div>
        {editable && (
          <StyleSwitcher
            currentStyle={style}
            customPersona={custom}
            onSwitch={handleSwitch}
          />
        )}
      </div>

      {isCustom && (
        <p className="text-xs text-gray-500 mb-2 border-l-2 border-cyan-700 pl-2">
          {custom}
        </p>
      )}

      {monologue ? (
        <div>
          <p className="text-gray-200 text-lg italic leading-relaxed">
            &ldquo;{monologue}&rdquo;
          </p>
          {monologueTime && (
            <p className="text-xs text-gray-500 text-right mt-2">
              — {timeAgo(monologueTime)}
            </p>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">
          AI 还没有发表独白，等待下一次交易...
        </p>
      )}
    </div>
  );
}
