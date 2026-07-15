import { useMemo } from "react";
import { Link } from "react-router-dom";
import { DEFAULT_CONFIG, EXPECTED } from "../engine/config";
import { validateConfig } from "../engine/config-rules";
import { getTicket, resetDemo, setPaused, useDemoStore } from "../store/demo";

/**
 * 后台管理（内部页面，中文）。
 *
 * 演示版能力：活动暂停/恢复、演示数据重置、发放与派奖看板、
 * 奖池配置查看与实时校验。正式版中这些操作对接服务端管理员 API，
 * 奖池配置在 DRAFT 状态可编辑、试算，冻结后只读（见开发计划）。
 */
export function Admin() {
  const state = useDemoStore();

  const stats = useMemo(() => {
    const completed = state.issued.filter((t) => t.completedAt !== null);
    let totalPayout = 0;
    let winningCount = 0;
    const tierCounts = new Map<number, number>();
    for (const t of completed) {
      const payout = getTicket(t.ticketId).finalPayout;
      totalPayout += payout;
      if (payout > 0) winningCount++;
      tierCounts.set(payout, (tierCounts.get(payout) ?? 0) + 1);
    }
    const faceValue = state.issued.length * DEFAULT_CONFIG.ticketFaceValue;
    return {
      issuedCount: state.issued.length,
      completedCount: completed.length,
      winningCount,
      totalPayout,
      faceValue,
      actualRtp: faceValue > 0 ? totalPayout / faceValue : 0,
      tierCounts: [...tierCounts.entries()].sort((a, b) => b[0] - a[0]),
      remaining: DEFAULT_CONFIG.totalTickets - state.issued.length,
    };
  }, [state.issued]);

  // 奖池配置实时校验（正式版为生成前的硬约束校验）
  const configErrors = useMemo(() => validateConfig(DEFAULT_CONFIG), []);

  // 按最终奖级汇总票型矩阵
  const tierTable = useMemo(() => {
    const map = new Map<number, { tickets: number; payout: number }>();
    for (const t of DEFAULT_CONFIG.templates) {
      const row = map.get(t.finalPayout) ?? { tickets: 0, payout: 0 };
      row.tickets += t.count;
      row.payout += t.finalPayout * t.count;
      map.set(t.finalPayout, row);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, []);

  const onTogglePause = () => {
    const next = !state.paused;
    if (confirm(next ? "确认暂停活动？暂停后用户无法领取新票。" : "确认恢复活动？")) {
      setPaused(next);
    }
  };

  const onReset = () => {
    if (confirm("确认重置全部演示数据？所有已领票据、进度和余额将被清空，此操作不可恢复。")) {
      resetDemo();
    }
  };

  return (
    <main className="page admin-page">
      <header className="admin-header">
        <h1>后台管理</h1>
        <Link to="/" className="ghost-btn">
          返回活动页
        </Link>
      </header>
      <p className="muted small">
        演示环境：数据保存在本浏览器。正式版中本页对接服务端管理员 API，操作需二次确认并记录审计日志。
      </p>

      <section className="admin-card">
        <h2>活动控制</h2>
        <div className="admin-controls">
          <div>
            <span className="label">活动状态</span>
            <strong className={state.paused ? "status-paused" : "status-active"}>
              {state.paused ? "已暂停（禁止新领取）" : "进行中"}
            </strong>
          </div>
          <div className="footer-actions">
            <button className="ghost-btn" onClick={onTogglePause}>
              {state.paused ? "恢复活动" : "暂停活动"}
            </button>
            <button className="danger-btn" onClick={onReset}>
              重置演示数据
            </button>
          </div>
        </div>
        <p className="muted small">暂停只阻止新领取；已领取的票仍可继续刮开和入账。</p>
      </section>

      <section className="admin-card">
        <h2>发放与派奖看板</h2>
        <div className="admin-stats">
          <div>
            <span className="label">已发放</span>
            <strong>{stats.issuedCount.toLocaleString("zh-CN")}</strong>
          </div>
          <div>
            <span className="label">剩余库存</span>
            <strong>{stats.remaining.toLocaleString("zh-CN")}</strong>
          </div>
          <div>
            <span className="label">已完成刮奖</span>
            <strong>{stats.completedCount.toLocaleString("zh-CN")}</strong>
          </div>
          <div>
            <span className="label">中奖票</span>
            <strong>{stats.winningCount.toLocaleString("zh-CN")}</strong>
          </div>
          <div>
            <span className="label">已派奖（代币）</span>
            <strong>{stats.totalPayout.toLocaleString("zh-CN")}</strong>
          </div>
          <div>
            <span className="label">实际返奖率</span>
            <strong>{(stats.actualRtp * 100).toFixed(2)}%</strong>
          </div>
        </div>
        {stats.tierCounts.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>已完成票的最终奖级</th>
                <th>票数</th>
              </tr>
            </thead>
            <tbody>
              {stats.tierCounts.map(([tier, count]) => (
                <tr key={tier}>
                  <td>{tier.toLocaleString("zh-CN")} 代币</td>
                  <td>{count.toLocaleString("zh-CN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-card">
        <h2>奖池配置（已冻结）</h2>
        <div className="admin-stats">
          <div>
            <span className="label">总发行量</span>
            <strong>{DEFAULT_CONFIG.totalTickets.toLocaleString("zh-CN")}</strong>
          </div>
          <div>
            <span className="label">票面价值</span>
            <strong>{DEFAULT_CONFIG.ticketFaceValue} 代币</strong>
          </div>
          <div>
            <span className="label">总奖池</span>
            <strong>{EXPECTED.totalPayout.toLocaleString("zh-CN")} 代币</strong>
          </div>
          <div>
            <span className="label">中奖票</span>
            <strong>{EXPECTED.winningTickets.toLocaleString("zh-CN")}</strong>
          </div>
          <div>
            <span className="label">中奖率</span>
            <strong>{(EXPECTED.winRate * 100).toFixed(4)}%</strong>
          </div>
          <div>
            <span className="label">理论返奖率</span>
            <strong>{(EXPECTED.rtp * 100).toFixed(0)}%</strong>
          </div>
          <div>
            <span className="label">TF 事件</span>
            <strong>{EXPECTED.tfEvents.toLocaleString("zh-CN")}</strong>
          </div>
          <div>
            <span className="label">配置校验</span>
            <strong className={configErrors.length === 0 ? "status-active" : "status-paused"}>
              {configErrors.length === 0 ? "通过" : `${configErrors.length} 个错误`}
            </strong>
          </div>
        </div>

        <h3>奖级分布</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>最终奖级</th>
              <th>票数</th>
              <th>该级总派奖</th>
            </tr>
          </thead>
          <tbody>
            {tierTable.map(([tier, row]) => (
              <tr key={tier}>
                <td>{tier.toLocaleString("zh-CN")} 代币</td>
                <td>{row.tickets.toLocaleString("zh-CN")}</td>
                <td>{row.payout.toLocaleString("zh-CN")} 代币</td>
              </tr>
            ))}
            <tr>
              <td>0 代币（未中奖）</td>
              <td>{DEFAULT_CONFIG.losingTickets.toLocaleString("zh-CN")}</td>
              <td>0</td>
            </tr>
          </tbody>
        </table>

        <h3>TF 库存</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>TF 基础奖金</th>
              <th>单格实得</th>
              <th>事件数</th>
            </tr>
          </thead>
          <tbody>
            {[...EXPECTED.tfInventory.entries()].map(([base, count]) => (
              <tr key={base}>
                <td>{base.toLocaleString("zh-CN")} 代币</td>
                <td>{(base * 2).toLocaleString("zh-CN")} 代币</td>
                <td>{count.toLocaleString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>中奖格数量分布</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>中奖格数</th>
              <th>票数</th>
            </tr>
          </thead>
          <tbody>
            {[...EXPECTED.cellCountDistribution.entries()].map(([cells, count]) => (
              <tr key={cells}>
                <td>{cells}</td>
                <td>{count.toLocaleString("zh-CN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          奖池已按精确票型矩阵冻结：修改配置需废弃当前版本并重新生成（正式版由服务端约束求解器试算后生成）。
        </p>
      </section>
    </main>
  );
}
