/**
 * 演示环境的本地状态：模拟“发放 → 刮奖进度 → 自动入账”的完整闭环。
 *
 * 正式版中这些操作全部由服务端事务完成（见开发计划第 6、9 节）；
 * 这里用 localStorage 保存等价的状态，接口形状与服务端 API 对齐，
 * 便于后续把实现替换为真实请求。
 *
 * 一致性策略：余额与累计中奖始终由已入账票据重新推导，
 * 坏记录逐条丢弃而不清空全部数据；跨标签页通过 storage 事件同步。
 */

import { useSyncExternalStore } from "react";
import { DEFAULT_CONFIG } from "../engine/config";
import { TicketFactory } from "../engine/tickets";
import type { Ticket } from "../engine/tickets";

export const ZONES_PER_TICKET = 21; // 1 个目标方向区 + 10 个方向区 + 10 个奖金区

export interface IssuedTicket {
  ticketId: number;
  issuedAt: number;
  /** 21 个刮除区域的完成状态：0 目标方向，1-10 方向区，11-20 奖金区 */
  zones: boolean[];
  completedAt: number | null;
  credited: boolean;
}

export interface DemoState {
  issued: IssuedTicket[];
  balance: number;
  totalWon: number;
  /** 活动暂停：禁止新领取，已领取票仍可继续刮开与入账 */
  paused: boolean;
}

const STORAGE_KEY = "tf-scratch-demo-v1";
export const factory = new TicketFactory(DEFAULT_CONFIG);

function isTimestamp(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

/** 逐字段校验并修复单条票据记录；无法修复返回 null（丢弃该条，不影响其他记录） */
function sanitizeIssued(raw: unknown): IssuedTicket | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (
    !Number.isInteger(r.ticketId) ||
    (r.ticketId as number) < 0 ||
    (r.ticketId as number) >= DEFAULT_CONFIG.totalTickets
  ) {
    return null;
  }
  if (!isTimestamp(r.issuedAt)) return null;
  if (!Array.isArray(r.zones) || r.zones.length !== ZONES_PER_TICKET) return null;
  const zones = r.zones.map((z) => z === true);
  const completedAt = isTimestamp(r.completedAt) ? r.completedAt : null;

  // 修复不变量：已完成 ⇒ 全部区域揭晓且已入账；全部揭晓 ⇒ 已完成
  if (completedAt !== null) {
    return { ticketId: r.ticketId as number, issuedAt: r.issuedAt, zones: zones.map(() => true), completedAt, credited: true };
  }
  if (zones.every(Boolean)) {
    return { ticketId: r.ticketId as number, issuedAt: r.issuedAt, zones, completedAt: Date.now(), credited: true };
  }
  return { ticketId: r.ticketId as number, issuedAt: r.issuedAt, zones, completedAt: null, credited: false };
}

/** 余额与累计中奖由已入账票据重新推导，保证账实一致 */
function deriveTotals(issued: IssuedTicket[]): { balance: number; totalWon: number } {
  let total = 0;
  for (const t of issued) {
    if (t.credited) total += factory.build(t.ticketId).finalPayout;
  }
  return { balance: total, totalWon: total };
}

function emptyState(): DemoState {
  return { issued: [], balance: 0, totalWon: 0, paused: false };
}

function loadState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return emptyState();
    const rawIssued = (parsed as Record<string, unknown>).issued;
    if (!Array.isArray(rawIssued)) return emptyState();

    const seen = new Set<number>();
    const issued: IssuedTicket[] = [];
    for (const item of rawIssued) {
      const ticket = sanitizeIssued(item);
      if (ticket && !seen.has(ticket.ticketId)) {
        seen.add(ticket.ticketId);
        issued.push(ticket);
      }
    }
    const paused = (parsed as Record<string, unknown>).paused === true;
    return { issued, paused, ...deriveTotals(issued) };
  } catch {
    return emptyState();
  }
}

let state: DemoState = loadState();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 存储不可用时演示数据只保留在内存 */
  }
}

function setState(next: DemoState) {
  state = next;
  persist();
  notify();
}

// 跨标签页同步：其他标签页写入后重新加载，避免用过期快照覆盖
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      state = loadState();
      notify();
    }
  });
}

export function useDemoStore(): DemoState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

export function getTicket(ticketId: number): Ticket {
  return factory.build(ticketId);
}

export function findIssued(ticketId: number): IssuedTicket | undefined {
  return state.issued.find((t) => t.ticketId === ticketId);
}

const CLAIM_RANDOM_ATTEMPTS = 32;

/**
 * 领取一张票：随机分配一个未使用的票号（等价于服务端预洗牌库存的下一张）。
 * 随机重试有限次后退化为从随机起点顺序扫描，保证接近售罄时也能在
 * O(totalTickets) 内结束，不会无限循环。
 */
export function claimTicket(): IssuedTicket {
  if (state.paused) throw new Error("paused");
  const used = new Set(state.issued.map((t) => t.ticketId));
  const total = DEFAULT_CONFIG.totalTickets;
  if (used.size >= total) throw new Error("sold out");

  const buf = new Uint32Array(1);
  const randomId = () => {
    crypto.getRandomValues(buf);
    return buf[0] % total;
  };

  let ticketId = -1;
  for (let i = 0; i < CLAIM_RANDOM_ATTEMPTS; i++) {
    const candidate = randomId();
    if (!used.has(candidate)) {
      ticketId = candidate;
      break;
    }
  }
  if (ticketId === -1) {
    const start = randomId();
    for (let offset = 0; offset < total; offset++) {
      const candidate = (start + offset) % total;
      if (!used.has(candidate)) {
        ticketId = candidate;
        break;
      }
    }
  }
  if (ticketId === -1) throw new Error("sold out");

  const issued: IssuedTicket = {
    ticketId,
    issuedAt: Date.now(),
    zones: new Array(ZONES_PER_TICKET).fill(false),
    completedAt: null,
    credited: false,
  };
  setState({ ...state, issued: [issued, ...state.issued] });
  return issued;
}

function settle(ticket: IssuedTicket): IssuedTicket {
  if (!ticket.zones.every(Boolean) || ticket.completedAt !== null) return ticket;
  // 完成结算与入账在同一次状态更新中提交（对应正式版的同事务 Outbox）
  return { ...ticket, completedAt: Date.now(), credited: true };
}

function updateTicket(ticketId: number, updater: (t: IssuedTicket) => IssuedTicket) {
  const index = state.issued.findIndex((t) => t.ticketId === ticketId);
  if (index === -1) return;
  const before = state.issued[index];
  const after = settle(updater(before));
  if (after === before) return;

  const issued = [...state.issued];
  issued[index] = after;
  setState({ ...state, issued, ...deriveTotals(issued) });
}

/** 上报单个刮除区域完成（幂等） */
export function completeZone(ticketId: number, zone: number) {
  if (!Number.isInteger(zone) || zone < 0 || zone >= ZONES_PER_TICKET) return;
  updateTicket(ticketId, (t) => {
    if (t.zones[zone]) return t;
    const zones = [...t.zones];
    zones[zone] = true;
    return { ...t, zones };
  });
}

/** 一键刮开：原子完成全部区域并立即结算 */
export function revealAll(ticketId: number) {
  updateTicket(ticketId, (t) =>
    t.zones.every(Boolean) ? t : { ...t, zones: new Array(ZONES_PER_TICKET).fill(true) },
  );
}

/* ── 后台管理操作（演示版对应正式版管理员 API） ── */

/** 暂停/恢复活动：只影响新领取，不影响已领取票 */
export function setPaused(paused: boolean) {
  if (state.paused === paused) return;
  setState({ ...state, paused });
}

/** 重置全部演示数据（对应正式版的清空测试环境，不存在于生产） */
export function resetDemo() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 忽略 */
  }
  setState(emptyState());
}
