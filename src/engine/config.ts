/**
 * 奖池配置与精确票型矩阵。
 *
 * 所有数字均满足硬约束：
 * - 总发行量 1,000,000 张
 * - 中奖票 330,821 张（中奖率 33.0821%）
 * - 总派奖 1,000,000 代币（返奖率 50%，按票面价值 2 代币计）
 * - 单格实际派奖 ≤ 20,000 代币，单票累计 ≤ 100,000 代币
 * - TF 格实际派奖 = 基础奖金 × 2，必定中奖
 */

/** 中奖格：普通（方向匹配）或 TF（翻倍） */
export interface WinningCellSpec {
  kind: "NORMAL" | "TF";
  /** 票面基础奖金 */
  base: number;
}

/** 一种票型模板：最终奖级 + 中奖格组成 + 精确张数 */
export interface TicketTemplate {
  /** 该票最终累计派奖（代币） */
  finalPayout: number;
  /** 中奖格组成，长度即中奖格数量 */
  cells: WinningCellSpec[];
  /** 该模板精确张数 */
  count: number;
}

export interface PoolConfig {
  totalTickets: number;
  /** 单张票面价值（代币），仅用于核算，不在领取时扣除 */
  ticketFaceValue: number;
  /** 每张票的刮奖格数量 */
  cellsPerTicket: number;
  /** 允许的普通基础奖金面值（中奖格实际派奖的合法来源） */
  allowedBases: number[];
  /**
   * 允许的未中奖格展示面值。
   * 产品明确要求未中奖格可展示高额票面（含 100,000）以增强感知，
   * 展示面值不参与派奖，因此与 allowedBases 分开管理。
   */
  allowedDisplayValues: number[];
  /** 单格实际派奖上限 */
  maxCellPayout: number;
  /** 单票累计派奖上限 */
  maxTicketPayout: number;
  /** 未中奖票张数 */
  losingTickets: number;
  /** 精确票型矩阵（中奖票） */
  templates: TicketTemplate[];
  /** 未中奖格展示奖金的权重（不影响真实派奖） */
  losingDisplayWeights: { value: number; weight: number }[];
  /** 展示票号批次 */
  series: string;
  /** 确定性生成种子（演示环境固定；生产应使用安全随机并存档） */
  seed: number;
}

const N = (base: number): WinningCellSpec => ({ kind: "NORMAL", base });
const TF = (base: number): WinningCellSpec => ({ kind: "TF", base });

/**
 * 精确票型矩阵（与开发计划 2.4 节一致，已通过程序验算）：
 * - 普通格贡献 750,000 代币，TF 格贡献 250,000 代币
 * - TF 事件共 34,005 个
 * - 中奖格分布：1格 280,000 / 2格 40,000 / 3格 9,000 / 4格 1,500 / 5格 251 / 6格 70
 */
export const DEFAULT_TEMPLATES: TicketTemplate[] = [
  // 1 代币：153,520 张
  { finalPayout: 1, count: 153_520, cells: [N(1)] },
  // 2 代币：148,240 张
  { finalPayout: 2, count: 20_000, cells: [TF(1)] },
  { finalPayout: 2, count: 103_420, cells: [N(2)] },
  { finalPayout: 2, count: 24_820, cells: [N(1), N(1)] },
  // 5 代币：20,000 张
  { finalPayout: 5, count: 10_000, cells: [TF(2), N(1)] },
  { finalPayout: 5, count: 9_000, cells: [N(2), N(2), N(1)] },
  { finalPayout: 5, count: 1_000, cells: [N(2), N(1), N(1), N(1)] },
  // 10 代币：5,000 张
  { finalPayout: 10, count: 3_000, cells: [TF(5)] },
  { finalPayout: 10, count: 2_000, cells: [N(5), N(5)] },
  // 20 代币：2,500 张
  { finalPayout: 20, count: 2_180, cells: [N(10), N(10)] },
  { finalPayout: 20, count: 320, cells: [N(5), N(5), N(5), N(5)] },
  // 50 代币：1,000 张
  { finalPayout: 50, count: 1_000, cells: [TF(20), N(10)] },
  // 100 代币：500 张
  { finalPayout: 100, count: 180, cells: [N(50), N(20), N(20), N(10)] },
  { finalPayout: 100, count: 250, cells: [N(20), N(20), N(20), N(20), N(20)] },
  { finalPayout: 100, count: 70, cells: [N(50), N(20), N(10), N(10), N(5), N(5)] },
  // 1,000 代币：50 张
  { finalPayout: 1_000, count: 50, cells: [N(1_000)] },
  // 10,000 代币：10 张
  { finalPayout: 10_000, count: 10, cells: [N(10_000)] },
  // 100,000 代币大奖：1 张，5 个 TF×10,000 格，每格实得 20,000
  {
    finalPayout: 100_000,
    count: 1,
    cells: [TF(10_000), TF(10_000), TF(10_000), TF(10_000), TF(10_000)],
  },
];

export const DEFAULT_CONFIG: PoolConfig = {
  totalTickets: 1_000_000,
  ticketFaceValue: 2,
  cellsPerTicket: 10,
  allowedBases: [1, 2, 5, 10, 20, 50, 100, 1_000, 10_000],
  allowedDisplayValues: [1, 2, 5, 10, 20, 50, 100, 1_000, 10_000, 100_000],
  maxCellPayout: 20_000,
  maxTicketPayout: 100_000,
  losingTickets: 669_179,
  templates: DEFAULT_TEMPLATES,
  losingDisplayWeights: [
    { value: 1, weight: 24 },
    { value: 2, weight: 20 },
    { value: 5, weight: 14 },
    { value: 10, weight: 12 },
    { value: 20, weight: 10 },
    { value: 50, weight: 8 },
    { value: 100, weight: 6 },
    { value: 1_000, weight: 3.5 },
    { value: 10_000, weight: 2 },
    { value: 100_000, weight: 0.5 },
  ],
  series: "S1",
  seed: 0x54465331, // "TFS1"
};

/** 预期汇总（用于校验与展示） */
export const EXPECTED = {
  totalTickets: 1_000_000,
  winningTickets: 330_821,
  totalPayout: 1_000_000,
  normalPayout: 750_000,
  tfPayout: 250_000,
  tfEvents: 34_005,
  winRate: 0.330821,
  rtp: 0.5,
  cellCountDistribution: new Map<number, number>([
    [0, 669_179],
    [1, 280_000],
    [2, 40_000],
    [3, 9_000],
    [4, 1_500],
    [5, 251],
    [6, 70],
  ]),
  tfInventory: new Map<number, number>([
    [1, 20_000],
    [2, 10_000],
    [5, 3_000],
    [20, 1_000],
    [10_000, 5],
  ]),
};
