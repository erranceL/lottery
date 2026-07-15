/**
 * 确定性票据生成。
 *
 * 每个票号 (0..totalTickets-1) 通过 Feistel 双射映射到唯一桶位，
 * 桶位按精确票型矩阵切分，因此整个奖池的每一张票在生成前就完全固定，
 * 不存在运行时随机决定中奖的情况。
 */

import type { PoolConfig, TicketTemplate } from "./config";
import { validateConfig } from "./config-rules";
import { FeistelPermutation, mix, nextInt, splitmix32 } from "./random";

export type Direction = "up" | "down";
export type CellSymbol = Direction | "tf";

export interface TicketCell {
  /** 刮开后显示的符号：涨 / 跌 / TF */
  symbol: CellSymbol;
  /** 票面展示奖金（未中奖格也会展示） */
  displayPrize: number;
  /** 派奖倍数：TF 为 2，其余为 1 */
  multiplier: 1 | 2;
  /** 该格实际派奖；未中奖恒为 0 */
  actualPayout: number;
  /** 是否中奖格 */
  isWinning: boolean;
}

export interface Ticket {
  /** 内部票号（0 起） */
  id: number;
  /** 展示编码，如 TF-S1-0000001-7K */
  displayNo: string;
  /** 本票目标方向 */
  target: Direction;
  cells: TicketCell[];
  /** 最终累计派奖 */
  finalPayout: number;
  /** 中奖格数量 */
  winningCellCount: number;
}

interface TemplateRange {
  template: TicketTemplate | null; // null 表示未中奖票
  start: number;
  end: number; // exclusive
}

export class TicketFactory {
  private readonly config: PoolConfig;
  private readonly perm: FeistelPermutation;
  private readonly ranges: TemplateRange[];
  private readonly losingDisplayCdf: { value: number; cum: number }[];
  private readonly losingDisplayTotal: number;

  constructor(config: PoolConfig, options?: { skipConfigValidation?: boolean }) {
    this.config = config;
    // 默认 fail fast：非法配置不允许构造出可用的票据工厂
    if (!options?.skipConfigValidation) {
      const errors = validateConfig(config);
      if (errors.length > 0) {
        throw new Error(`奖池配置未通过校验：\n${errors.join("\n")}`);
      }
    }
    this.perm = new FeistelPermutation(config.totalTickets, config.seed);

    this.ranges = [];
    let cursor = 0;
    for (const template of config.templates) {
      this.ranges.push({ template, start: cursor, end: cursor + template.count });
      cursor += template.count;
    }
    this.ranges.push({ template: null, start: cursor, end: config.totalTickets });

    let cum = 0;
    this.losingDisplayCdf = config.losingDisplayWeights.map(({ value, weight }) => {
      cum += weight;
      return { value, cum };
    });
    this.losingDisplayTotal = cum;
  }

  /** 二分查找桶位所属票型 */
  private templateForBucket(bucket: number): TicketTemplate | null {
    let lo = 0;
    let hi = this.ranges.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const range = this.ranges[mid];
      if (bucket < range.start) hi = mid - 1;
      else if (bucket >= range.end) lo = mid + 1;
      else return range.template;
    }
    throw new Error(`bucket ${bucket} 未落入任何票型区间`);
  }

  private sampleLosingDisplay(rng: () => number): number {
    const roll = rng() * this.losingDisplayTotal;
    for (const { value, cum } of this.losingDisplayCdf) {
      if (roll < cum) return value;
    }
    return this.losingDisplayCdf[this.losingDisplayCdf.length - 1].value;
  }

  /** 票号映射到的桶位（供双射唯一性全量校验使用） */
  bucketOf(id: number): number {
    return this.perm.map(id);
  }

  displayNo(id: number): string {
    const serial = String(id + 1).padStart(7, "0");
    const check = (mix(this.config.seed ^ 0x5f3759df, id) % 1296)
      .toString(36)
      .toUpperCase()
      .padStart(2, "0");
    return `TF-${this.config.series}-${serial}-${check}`;
  }

  build(id: number): Ticket {
    const { config } = this;
    if (id < 0 || id >= config.totalTickets || !Number.isInteger(id)) {
      throw new RangeError(`非法票号 ${id}`);
    }
    const bucket = this.perm.map(id);
    const template = this.templateForBucket(bucket);
    const rng = splitmix32(mix(config.seed, id));

    const target: Direction = rng() < 0.5 ? "up" : "down";
    const losingDirection: Direction = target === "up" ? "down" : "up";

    // 洗牌选出中奖格位置（Fisher–Yates 前 k 位）
    const positions = Array.from({ length: config.cellsPerTicket }, (_, i) => i);
    for (let i = positions.length - 1; i > 0; i--) {
      const j = nextInt(rng, i + 1);
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const winningCells = template?.cells ?? [];
    const winningPositions = new Map<number, number>(); // position -> cell spec index
    winningCells.forEach((_, index) => winningPositions.set(positions[index], index));

    const cells: TicketCell[] = [];
    for (let pos = 0; pos < config.cellsPerTicket; pos++) {
      const specIndex = winningPositions.get(pos);
      if (specIndex !== undefined) {
        const spec = winningCells[specIndex];
        const multiplier = spec.kind === "TF" ? 2 : 1;
        cells.push({
          symbol: spec.kind === "TF" ? "tf" : target,
          displayPrize: spec.base,
          multiplier: multiplier as 1 | 2,
          actualPayout: spec.base * multiplier,
          isWinning: true,
        });
      } else {
        cells.push({
          symbol: losingDirection,
          displayPrize: this.sampleLosingDisplay(rng),
          multiplier: 1,
          actualPayout: 0,
          isWinning: false,
        });
      }
    }

    const finalPayout = cells.reduce((s, c) => s + c.actualPayout, 0);
    return {
      id,
      displayNo: this.displayNo(id),
      target,
      cells,
      finalPayout,
      winningCellCount: winningCells.length,
    };
  }
}
