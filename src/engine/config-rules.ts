/**
 * 配置硬约束校验（独立模块，供 TicketFactory 与全量校验器共用）。
 */

import type { PoolConfig } from "./config";

function isCount(n: number): boolean {
  return Number.isSafeInteger(n) && n > 0;
}

export function validateConfig(config: PoolConfig): string[] {
  const errors: string[] = [];

  if (!isCount(config.totalTickets)) errors.push(`发行量非法：${config.totalTickets}`);
  if (!isCount(config.cellsPerTicket)) errors.push(`格数非法：${config.cellsPerTicket}`);
  if (!isCount(config.ticketFaceValue)) errors.push(`票面价值非法：${config.ticketFaceValue}`);
  if (!isCount(config.maxCellPayout)) errors.push(`单格上限非法：${config.maxCellPayout}`);
  if (!isCount(config.maxTicketPayout)) errors.push(`单票上限非法：${config.maxTicketPayout}`);
  if (!Number.isSafeInteger(config.losingTickets) || config.losingTickets < 0) {
    errors.push(`未中奖票数非法：${config.losingTickets}`);
  }
  for (const base of config.allowedBases) {
    if (!isCount(base)) errors.push(`允许面值非法：${base}`);
  }
  for (const value of config.allowedDisplayValues) {
    if (!isCount(value)) errors.push(`展示面值列表包含非法值：${value}`);
  }
  const allowed = new Set(config.allowedBases);
  const allowedDisplay = new Set(config.allowedDisplayValues);

  let totalWeight = 0;
  for (const { value, weight } of config.losingDisplayWeights) {
    if (!allowedDisplay.has(value)) errors.push(`展示面值 ${value} 不在允许列表`);
    if (!Number.isFinite(weight) || weight < 0) errors.push(`展示权重非法：${value} → ${weight}`);
    totalWeight += weight;
  }
  if (!(totalWeight > 0)) errors.push("展示权重总和必须为正");

  let winningTickets = 0;
  let totalPayout = 0;
  for (const [i, t] of config.templates.entries()) {
    if (!isCount(t.count)) {
      errors.push(`模板#${i} 张数非法：${t.count}`);
      continue;
    }
    winningTickets += t.count;
    totalPayout += t.finalPayout * t.count;
    if (!isCount(t.finalPayout)) errors.push(`模板#${i} 最终奖级非法：${t.finalPayout}`);
    if (t.cells.length < 1 || t.cells.length > config.cellsPerTicket) {
      errors.push(`模板#${i} 中奖格数量非法：${t.cells.length}`);
    }
    let sum = 0;
    for (const cell of t.cells) {
      if (!allowed.has(cell.base)) {
        errors.push(`模板#${i} 使用了未批准面值 ${cell.base}`);
      }
      const payout = cell.kind === "TF" ? cell.base * 2 : cell.base;
      if (payout > config.maxCellPayout) {
        errors.push(`模板#${i} 单格派奖 ${payout} 超过上限 ${config.maxCellPayout}`);
      }
      sum += payout;
    }
    if (sum !== t.finalPayout) {
      errors.push(`模板#${i} 格子累计 ${sum} ≠ 最终奖级 ${t.finalPayout}`);
    }
    if (t.finalPayout > config.maxTicketPayout) {
      errors.push(`模板#${i} 最终奖级 ${t.finalPayout} 超过单票上限 ${config.maxTicketPayout}`);
    }
  }
  if (!Number.isSafeInteger(totalPayout)) errors.push("总派奖超出安全整数范围");
  if (winningTickets + config.losingTickets !== config.totalTickets) {
    errors.push(
      `总量不闭合：中奖 ${winningTickets} + 未中奖 ${config.losingTickets} ≠ ${config.totalTickets}`,
    );
  }
  const expectedPool = (config.totalTickets * config.ticketFaceValue) / 2;
  if (totalPayout !== expectedPool) {
    errors.push(`总派奖 ${totalPayout} ≠ 目标奖池 ${expectedPool}`);
  }
  return errors;
}
