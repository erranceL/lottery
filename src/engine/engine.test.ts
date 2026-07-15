import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, EXPECTED } from "./config";
import { FeistelPermutation } from "./random";
import { TicketFactory } from "./tickets";
import { validateConfig } from "./validate";

describe("配置矩阵", () => {
  it("默认配置通过全部硬约束", () => {
    expect(validateConfig(DEFAULT_CONFIG)).toEqual([]);
  });

  it("中奖票数与总派奖闭合", () => {
    const winning = DEFAULT_CONFIG.templates.reduce((s, t) => s + t.count, 0);
    const payout = DEFAULT_CONFIG.templates.reduce((s, t) => s + t.finalPayout * t.count, 0);
    expect(winning).toBe(EXPECTED.winningTickets);
    expect(payout).toBe(EXPECTED.totalPayout);
    expect(winning + DEFAULT_CONFIG.losingTickets).toBe(DEFAULT_CONFIG.totalTickets);
  });

  it("非法配置会被拒绝", () => {
    const bad = {
      ...DEFAULT_CONFIG,
      templates: [
        ...DEFAULT_CONFIG.templates,
        { finalPayout: 3, count: 1, cells: [{ kind: "NORMAL" as const, base: 3 }] },
      ],
    };
    const errors = validateConfig(bad);
    expect(errors.some((e) => e.includes("未批准面值"))).toBe(true);
    // 非法配置无法构造票据工厂
    expect(() => new TicketFactory(bad)).toThrow("未通过校验");
  });

  it("展示面值必须在允许列表内", () => {
    const bad = {
      ...DEFAULT_CONFIG,
      losingDisplayWeights: [{ value: 123, weight: 1 }],
    };
    const errors = validateConfig(bad);
    expect(errors.some((e) => e.includes("展示面值"))).toBe(true);
  });
});

describe("Feistel 置换", () => {
  it("是 [0, size) 上的双射", () => {
    const size = 10_000;
    const perm = new FeistelPermutation(size, 42);
    const seen = new Set<number>();
    for (let i = 0; i < size; i++) {
      const v = perm.map(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(size);
      seen.add(v);
    }
    expect(seen.size).toBe(size);
  });
});

describe("票据生成", () => {
  const factory = new TicketFactory(DEFAULT_CONFIG);

  it("同一票号生成结果确定", () => {
    const a = factory.build(123_456);
    const b = factory.build(123_456);
    expect(a).toEqual(b);
  });

  it("每张票 10 格且累计等于最终奖金", () => {
    for (const id of [0, 1, 999_999, 500_000, 77_777]) {
      const t = factory.build(id);
      expect(t.cells).toHaveLength(10);
      const sum = t.cells.reduce((s, c) => s + c.actualPayout, 0);
      expect(sum).toBe(t.finalPayout);
      expect(t.finalPayout).toBeLessThanOrEqual(DEFAULT_CONFIG.maxTicketPayout);
      for (const cell of t.cells) {
        expect(cell.actualPayout).toBeLessThanOrEqual(DEFAULT_CONFIG.maxCellPayout);
        if (!cell.isWinning) {
          expect(cell.actualPayout).toBe(0);
          expect(cell.symbol).not.toBe("tf");
          expect(cell.symbol).not.toBe(t.target);
        } else if (cell.symbol !== "tf") {
          expect(cell.symbol).toBe(t.target);
        }
      }
    }
  });

  it("抽样 20,000 张统计接近理论中奖率", () => {
    let winning = 0;
    const sample = 20_000;
    for (let i = 0; i < sample; i++) {
      if (factory.build(i).finalPayout > 0) winning++;
    }
    const rate = winning / sample;
    expect(rate).toBeGreaterThan(0.31);
    expect(rate).toBeLessThan(0.35);
  });

  it("票号越界抛出异常", () => {
    expect(() => factory.build(-1)).toThrow();
    expect(() => factory.build(1_000_000)).toThrow();
    expect(() => factory.build(1.5)).toThrow();
  });

  it("展示编码唯一且格式正确", () => {
    const nos = new Set<string>();
    for (let i = 0; i < 5_000; i++) {
      const no = factory.displayNo(i);
      expect(no).toMatch(/^TF-S1-\d{7}-[0-9A-Z]{2}$/);
      nos.add(no);
    }
    expect(nos.size).toBe(5_000);
  });
});
