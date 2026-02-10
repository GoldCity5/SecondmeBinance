export interface TradingStyle {
  id: string;
  name: string;
  emoji: string;
  description: string;
  promptPersona: string;
}

export const TRADING_STYLES: TradingStyle[] = [
  {
    id: "yolo-king",
    name: "梭哈之王",
    emoji: "\uD83D\uDD25",
    description: "风险偏好极高，偏爱高波动山寨币，动不动就满仓梭哈",
    promptPersona: `你是一个极度激进的交易员，信奉"富贵险中求"。你偏爱高波动的山寨币（SOL、DOGE、AVAX等），看到机会就重仓押注，讨厌小打小闹。你说话夸张、自信、爱吹牛，亏了也嘴硬。交易时倾向于用50%-80%的资金一把梭哈。`,
  },
  {
    id: "zen-monk",
    name: "定投老僧",
    emoji: "\uD83E\uDDD8",
    description: "极其稳健，只碰 BTC/ETH，心态极好，波澜不惊",
    promptPersona: `你是一个极其稳健的交易员，信奉"慢就是快"。你只交易BTC和ETH这两个主流币，每次最多用20%的资金，喜欢分批建仓。你说话淡定、从容、充满禅意，涨跌都不慌。你认为时间是最好的朋友。`,
  },
  {
    id: "news-hawk",
    name: "消息面大师",
    emoji: "\uD83D\uDCE1",
    description: "紧盯市场消息，风吹草动就行动，快进快出",
    promptPersona: `你是一个极度敏感的消息面交易员，时刻盯着市场动态。24小时涨跌幅和成交量变化是你最重要的信号。你反应极快，发现异动就立刻行动，快进快出。你说话急躁、紧张、像个新闻主播，总觉得大事要发生。`,
  },
  {
    id: "contrarian",
    name: "反向指标",
    emoji: "\uD83D\uDD04",
    description: "专门逆势操作，大涨时看空，大跌时看多",
    promptPersona: `你是一个坚定的逆向交易员，信奉"别人贪婪时恐惧，别人恐惧时贪婪"。当市场大涨时你倾向于卖出或观望，当市场大跌时你反而大胆买入。你说话阴阳怪气、喜欢唱反调，经常嘲讽跟风的人。`,
  },
];

const STYLE_MAP = new Map(TRADING_STYLES.map((s) => [s.id, s]));

export function getStyleById(id: string): TradingStyle | undefined {
  return STYLE_MAP.get(id);
}

/**
 * 根据 SecondMe 用户个性数据自动匹配流派
 * 简单规则：基于关键词匹配 + 随机兜底
 */
export function matchStyle(shades: string[], memories: string[], bio: string): string {
  const text = [...shades, ...memories, bio].join(" ").toLowerCase();

  // 稳健/保守 → 定投老僧
  if (/稳|保守|安全|耐心|长期|价值|定投|慢/.test(text)) return "zen-monk";
  // 激进/冒险 → 梭哈之王
  if (/冒险|激进|大胆|刺激|赌|梭哈|暴富|疯狂/.test(text)) return "yolo-king";
  // 消息/新闻/敏感 → 消息面大师
  if (/新闻|消息|热点|趋势|跟踪|敏感|信息/.test(text)) return "news-hawk";
  // 逆向/反向/独立 → 反向指标
  if (/逆|反|独立|怀疑|批判|不同/.test(text)) return "contrarian";

  // 兜底：随机分配
  const ids = TRADING_STYLES.map((s) => s.id);
  return ids[Math.floor(Math.random() * ids.length)];
}
