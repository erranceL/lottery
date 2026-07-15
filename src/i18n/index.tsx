import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "zh" | "en";

const dict = {
  zh: {
    brandTagline: "TURBOFLOW 活动奖励",
    title: "刮开市场",
    subtitle: "涨，还是跌？匹配方向赢代币；刮出 TF，奖金翻倍。",
    balance: "代币余额",
    claim: "领取一张刮刮乐",
    claiming: "领取中…",
    soldOut: "本活动票已全部发完",
    myTickets: "我的刮刮乐",
    history: "刮奖记录",
    ticketNo: "票号",
    chances: "次机会",
    yourDirection: "刮开你的方向",
    yourDirectionLabel: "你的方向",
    tradingChances: "刮开方向与奖金",
    revealAll: "一键刮开",
    ruleMatch: "方向一致",
    ruleMatchDesc: "获得该格奖金",
    ruleTf: "刮出 TF",
    ruleTfDesc: "该格奖金 × 2",
    ruleStack: "奖金兼中兼得",
    ruleStackDesc: "本票最多 10 次机会",
    up: "涨",
    down: "跌",
    higher: "HIGHER",
    lower: "LOWER",
    tfBonus: "奖金 ×2",
    prize: "奖金",
    scratchHint: "刮开",
    resultWin: "恭喜你获得",
    resultLose: "很遗憾，本张未中奖",
    resultLoseSub: "下一张可能就是大奖",
    jackpot: "JACKPOT！恭喜刮中大奖！",
    credited: "已自动入账",
    scratchNext: "再刮一张",
    backHome: "返回活动页",
    continueScratch: "继续刮奖",
    viewResult: "查看结果",
    tokens: "代币",
    statusDone: "已完成",
    statusScratching: "刮奖中",
    statusNew: "未开刮",
    emptyTickets: "还没有刮刮乐，先领一张吧",
    emptyHistory: "暂无记录",
    issuedAt: "获得时间",
    completedAt: "完成时间",
    payout: "最终奖金",
    rewardStatus: "入账状态",
    rewardCredited: "已入账",
    rewardPending: "待完成",
    totalStats: "累计中奖",
    demoBadge: "演示环境 · 本地模拟账务",
    maxPrize: "最高可得",
    notFound: "票据不存在",
    langSwitch: "EN",
  },
  en: {
    brandTagline: "TURBOFLOW EVENT REWARD",
    title: "Scratch the Market",
    subtitle: "Higher or lower? Match the direction to win Tokens. TF doubles the prize.",
    balance: "Token Balance",
    claim: "Claim a Ticket",
    claiming: "Claiming…",
    soldOut: "All tickets have been issued",
    myTickets: "My Tickets",
    history: "History",
    ticketNo: "Ticket No.",
    chances: "chances",
    yourDirection: "Scratch Your Direction",
    yourDirectionLabel: "YOUR DIRECTION",
    tradingChances: "Scratch Directions & Prizes",
    revealAll: "Reveal All",
    ruleMatch: "Match Direction",
    ruleMatchDesc: "Win the cell prize",
    ruleTf: "Hit TF",
    ruleTfDesc: "Cell prize × 2",
    ruleStack: "Prizes Stack",
    ruleStackDesc: "Up to 10 chances per ticket",
    up: "UP",
    down: "DOWN",
    higher: "HIGHER",
    lower: "LOWER",
    tfBonus: "BONUS ×2",
    prize: "PRIZE",
    scratchHint: "Scratch",
    resultWin: "Congratulations! You won",
    resultLose: "No win this time",
    resultLoseSub: "The next one could be the jackpot",
    jackpot: "JACKPOT! You hit the top prize!",
    credited: "Credited automatically",
    scratchNext: "Scratch Another",
    backHome: "Back to Event",
    continueScratch: "Continue",
    viewResult: "View Result",
    tokens: "Tokens",
    statusDone: "Completed",
    statusScratching: "In Progress",
    statusNew: "New",
    emptyTickets: "No tickets yet. Claim one to start.",
    emptyHistory: "No records yet",
    issuedAt: "Issued",
    completedAt: "Completed",
    payout: "Final Prize",
    rewardStatus: "Reward",
    rewardCredited: "Credited",
    rewardPending: "Pending",
    totalStats: "Total Won",
    demoBadge: "Demo build · local simulated ledger",
    maxPrize: "Top prize",
    notFound: "Ticket not found",
    langSwitch: "中文",
  },
} as const;

export type DictKey = keyof (typeof dict)["zh"];

interface I18nValue {
  lang: Lang;
  /** 当前语言的 BCP 47 locale，用于数字与日期格式化 */
  locale: string;
  t: (key: DictKey) => string;
  formatNumber: (n: number) => string;
  toggle: () => void;
}

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = "tf-scratch-lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    /* localStorage 不可用时忽略 */
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next: Lang = prev === "zh" ? "en" : "zh";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* 忽略 */
      }
      return next;
    });
  }, []);

  const value = useMemo<I18nValue>(() => {
    const locale = lang === "zh" ? "zh-CN" : "en-US";
    return {
      lang,
      locale,
      toggle,
      t: (key) => dict[lang][key],
      formatNumber: (n) => n.toLocaleString(locale),
    };
  }, [lang, toggle]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
