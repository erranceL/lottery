/**
 * 奖池校验。
 *
 * validateConfig：校验票型矩阵本身（张数、金额、上限、TF 规则、展示面值）。
 * validatePool：逐张生成全部票据并核对每一项汇总（含票号双射唯一性），
 * 属于全量校验，供脚本 scripts/validate-pool.ts 与单元测试使用。
 */

import type { PoolConfig } from "./config";
import { EXPECTED } from "./config";
import { validateConfig } from "./config-rules";
import { TicketFactory } from "./tickets";

export { validateConfig };

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  /** 实际校验的票数；aborted 为 true 时小于配置总量 */
  processedTickets: number;
  /** 错误过多提前中止时为 true，此时不执行最终汇总断言 */
  aborted: boolean;
  stats: {
    totalTickets: number;
    winningTickets: number;
    totalPayout: number;
    normalPayout: number;
    tfPayout: number;
    tfEvents: number;
    upTickets: number;
    cellCountDistribution: Record<number, number>;
    tierDistribution: Record<number, number>;
    tfInventory: Record<number, number>;
    positionWins: number[];
  };
}

const MAX_ERRORS = 50;

export function validatePool(
  config: PoolConfig,
  onProgress?: (done: number) => void,
): ValidationReport {
  const errors = validateConfig(config);
  const factory = new TicketFactory(config, { skipConfigValidation: true });
  const allowedDisplay = new Set(config.allowedDisplayValues);

  let winningTickets = 0;
  let totalPayout = 0;
  let normalPayout = 0;
  let tfPayout = 0;
  let tfEvents = 0;
  let upTickets = 0;
  let processedTickets = 0;
  let aborted = false;
  const cellCountDistribution: Record<number, number> = {};
  const tierDistribution: Record<number, number> = {};
  const tfInventory: Record<number, number> = {};
  const positionWins: number[] = new Array(config.cellsPerTicket).fill(0);
  // 票号 → 桶位双射唯一性检查
  const bucketSeen = new Uint8Array(config.totalTickets);

  for (let id = 0; id < config.totalTickets; id++) {
    const ticket = factory.build(id);
    processedTickets++;

    const bucket = factory.bucketOf(id);
    if (bucketSeen[bucket]) {
      errors.push(`桶位 ${bucket} 被重复映射（票 ${id}），置换不是双射`);
    }
    bucketSeen[bucket] = 1;

    if (ticket.finalPayout > 0) winningTickets++;
    if (ticket.target === "up") upTickets++;
    totalPayout += ticket.finalPayout;
    cellCountDistribution[ticket.winningCellCount] =
      (cellCountDistribution[ticket.winningCellCount] ?? 0) + 1;
    tierDistribution[ticket.finalPayout] = (tierDistribution[ticket.finalPayout] ?? 0) + 1;

    if (ticket.cells.length !== config.cellsPerTicket) {
      errors.push(`票 ${id} 格数 ${ticket.cells.length} ≠ ${config.cellsPerTicket}`);
    }
    let cellSum = 0;
    ticket.cells.forEach((cell, pos) => {
      cellSum += cell.actualPayout;
      if (!allowedDisplay.has(cell.displayPrize)) {
        errors.push(`票 ${id} 展示面值 ${cell.displayPrize} 不在允许列表`);
      }
      if (cell.isWinning) {
        positionWins[pos]++;
        if (cell.symbol === "tf") {
          tfEvents++;
          tfPayout += cell.actualPayout;
          tfInventory[cell.displayPrize] = (tfInventory[cell.displayPrize] ?? 0) + 1;
          if (cell.multiplier !== 2 || cell.actualPayout !== cell.displayPrize * 2) {
            errors.push(`票 ${id} TF 格派奖 ${cell.actualPayout} ≠ 基础 ${cell.displayPrize}×2`);
          }
        } else {
          normalPayout += cell.actualPayout;
          if (cell.multiplier !== 1 || cell.actualPayout !== cell.displayPrize) {
            errors.push(`票 ${id} 普通中奖格派奖与票面不一致`);
          }
          if (cell.symbol !== ticket.target) {
            errors.push(`票 ${id} 普通中奖格方向与目标不一致`);
          }
        }
        if (cell.actualPayout > config.maxCellPayout) {
          errors.push(`票 ${id} 单格派奖超限：${cell.actualPayout}`);
        }
      } else {
        if (cell.actualPayout !== 0) errors.push(`票 ${id} 未中奖格派奖非 0`);
        if (cell.symbol === "tf") errors.push(`票 ${id} 未中奖格出现 TF`);
        if (cell.symbol === ticket.target) errors.push(`票 ${id} 未中奖格方向与目标一致`);
      }
    });
    if (cellSum !== ticket.finalPayout) {
      errors.push(`票 ${id} 格子累计 ${cellSum} ≠ finalPayout ${ticket.finalPayout}`);
    }
    if (ticket.finalPayout > config.maxTicketPayout) {
      errors.push(`票 ${id} 单票派奖超限：${ticket.finalPayout}`);
    }
    if (onProgress && processedTickets % 100_000 === 0) onProgress(processedTickets);
    if (errors.length > MAX_ERRORS) {
      aborted = true;
      errors.push(`错误超过 ${MAX_ERRORS} 个，校验提前中止（已处理 ${processedTickets} 张）`);
      break;
    }
  }

  // 提前中止时统计不完整，跳过汇总断言避免误导
  if (!aborted) {
    const check = (label: string, actual: number, expected: number) => {
      if (actual !== expected) errors.push(`${label}：实际 ${actual} ≠ 预期 ${expected}`);
    };
    check("中奖票数", winningTickets, EXPECTED.winningTickets);
    check("总派奖", totalPayout, EXPECTED.totalPayout);
    check("普通格派奖", normalPayout, EXPECTED.normalPayout);
    check("TF格派奖", tfPayout, EXPECTED.tfPayout);
    check("TF事件数", tfEvents, EXPECTED.tfEvents);
    for (const [count, expected] of EXPECTED.cellCountDistribution) {
      check(`中奖格数=${count} 的票数`, cellCountDistribution[count] ?? 0, expected);
    }
    for (const [base, expected] of EXPECTED.tfInventory) {
      check(`TF+${base} 事件数`, tfInventory[base] ?? 0, expected);
    }
    // 目标方向允许 ±0.25 个百分点偏差
    const upRatio = upTickets / config.totalTickets;
    if (Math.abs(upRatio - 0.5) > 0.0025) {
      errors.push(`目标方向偏差过大：涨占比 ${(upRatio * 100).toFixed(4)}%`);
    }
    // 中奖位置分布：相对平均值偏差 ≤ 1%
    const totalWins = positionWins.reduce((s, v) => s + v, 0);
    const avg = totalWins / config.cellsPerTicket;
    positionWins.forEach((wins, pos) => {
      if (avg > 0 && Math.abs(wins - avg) / avg > 0.01) {
        errors.push(`位置 ${pos + 1} 中奖数 ${wins} 偏离平均值 ${avg.toFixed(0)} 超过 1%`);
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    processedTickets,
    aborted,
    stats: {
      totalTickets: config.totalTickets,
      winningTickets,
      totalPayout,
      normalPayout,
      tfPayout,
      tfEvents,
      upTickets,
      cellCountDistribution,
      tierDistribution,
      tfInventory,
      positionWins,
    },
  };
}
