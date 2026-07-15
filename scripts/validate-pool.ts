/**
 * 全量奖池校验脚本：逐张生成 1,000,000 张票并核对所有约束。
 * 运行：npm run validate:pool
 */

import { DEFAULT_CONFIG } from "../src/engine/config";
import { validatePool } from "../src/engine/validate";

const start = Date.now();
const report = validatePool(DEFAULT_CONFIG, (done) => {
  process.stdout.write(`\r已校验 ${done.toLocaleString()} 张…`);
});
process.stdout.write("\n");

const { stats } = report;
console.log("== 奖池全量校验报告 ==");
console.log(`总票数        ${stats.totalTickets.toLocaleString()}`);
console.log(`中奖票        ${stats.winningTickets.toLocaleString()}`);
console.log(`总派奖        ${stats.totalPayout.toLocaleString()} 代币`);
console.log(`普通格派奖    ${stats.normalPayout.toLocaleString()} 代币`);
console.log(`TF格派奖      ${stats.tfPayout.toLocaleString()} 代币`);
console.log(`TF事件        ${stats.tfEvents.toLocaleString()}`);
console.log(`涨方向票      ${stats.upTickets.toLocaleString()} (${((stats.upTickets / stats.totalTickets) * 100).toFixed(4)}%)`);
console.log("中奖格分布   ", stats.cellCountDistribution);
console.log("奖级分布     ", stats.tierDistribution);
console.log("TF库存       ", stats.tfInventory);
console.log("位置中奖数   ", stats.positionWins.map((n) => n.toLocaleString()).join(", "));
console.log(`耗时 ${((Date.now() - start) / 1000).toFixed(1)}s`);

if (report.ok) {
  console.log("\n✔ 全部约束通过");
} else {
  console.error(`\n✘ 发现 ${report.errors.length} 个问题：`);
  for (const err of report.errors.slice(0, 20)) console.error(" -", err);
  process.exit(1);
}
