import { Link, useNavigate, useParams } from "react-router-dom";
import { ScratchCard } from "../components/ScratchCard";
import { DirectionReveal, PrizeReveal } from "../components/reveals";
import { useI18n } from "../i18n";
import {
  claimTicket,
  completeZone,
  findIssued,
  getTicket,
  revealAll,
  useDemoStore,
} from "../store/demo";

/**
 * 区域编号约定（与 store 一致）：
 * 0 = 目标方向区；1..10 = 第 i 格方向区；11..20 = 第 i 格奖金区。
 */
const zoneForSymbol = (cellIndex: number) => 1 + cellIndex;
const zoneForPrize = (cellIndex: number) => 11 + cellIndex;

export function TicketPage() {
  const { id } = useParams();
  const { t, formatNumber } = useI18n();
  const navigate = useNavigate();
  useDemoStore(); // 订阅状态变化

  // 只接受十进制非负整数票号，拒绝空白、科学计数法等宽松形式
  const ticketId = id && /^(0|[1-9]\d*)$/.test(id) ? Number(id) : NaN;
  const issued = Number.isInteger(ticketId) ? findIssued(ticketId) : undefined;
  if (!issued) {
    return (
      <main className="page">
        <p className="muted empty">{t("notFound")}</p>
        <Link to="/" className="ghost-btn">
          {t("backHome")}
        </Link>
      </main>
    );
  }

  const ticket = getTicket(ticketId);
  const done = issued.completedAt !== null;
  const isJackpot = ticket.finalPayout >= 10_000;

  const onScratchNext = () => {
    try {
      const next = claimTicket();
      navigate(`/ticket/${next.ticketId}`);
    } catch {
      alert(t("soldOut"));
    }
  };

  return (
    <main className="page">
      <header className="ticket-header">
        <Link to="/" className="ghost-btn back-btn">
          ← {t("backHome")}
        </Link>
        <div className="ticket-no">
          <span className="label">{t("ticketNo")}</span>
          <strong className="mono">{ticket.displayNo}</strong>
        </div>
        <div className="chance-badge">
          <strong>10</strong>
          <span>{t("chances")}</span>
        </div>
      </header>

      <section className="direction-panel">
        <h2>{t("yourDirection")}</h2>
        <div className="direction-card">
          <ScratchCard revealed={issued.zones[0]} onComplete={() => completeZone(ticketId, 0)}>
            <DirectionReveal symbol={ticket.target} />
          </ScratchCard>
        </div>
      </section>

      <section className="grid-section">
        <div className="grid-header">
          <h2>{t("tradingChances")}</h2>
          {!done && (
            <button className="ghost-btn" onClick={() => revealAll(ticketId)}>
              {t("revealAll")}
            </button>
          )}
        </div>
        <div className="chance-grid">
          {ticket.cells.map((cell, index) => (
            <article className="chance" key={index}>
              <div className="chance-num">{String(index + 1).padStart(2, "0")}</div>
              <ScratchCard
                revealed={issued.zones[zoneForSymbol(index)]}
                onComplete={() => completeZone(ticketId, zoneForSymbol(index))}
              >
                <DirectionReveal symbol={cell.symbol} />
              </ScratchCard>
              <ScratchCard
                revealed={issued.zones[zoneForPrize(index)]}
                onComplete={() => completeZone(ticketId, zoneForPrize(index))}
              >
                <PrizeReveal value={cell.displayPrize} winning={cell.isWinning && done} />
              </ScratchCard>
            </article>
          ))}
        </div>
      </section>

      {done && (
        <section
          className={`result ${ticket.finalPayout > 0 ? "result-win" : "result-lose"}`}
          aria-live="polite"
        >
          {ticket.finalPayout > 0 ? (
            <>
              {isJackpot && <div className="jackpot">{t("jackpot")}</div>}
              <div className="result-title">{t("resultWin")}</div>
              <div className="result-amount">
                {formatNumber(ticket.finalPayout)} <em>{t("tokens")}</em>
              </div>
              <div className="credited">✓ {t("credited")}</div>
            </>
          ) : (
            <>
              <div className="result-title">{t("resultLose")}</div>
              <div className="muted">{t("resultLoseSub")}</div>
            </>
          )}
          <button className="primary-btn" onClick={onScratchNext}>
            {t("scratchNext")}
          </button>
        </section>
      )}
    </main>
  );
}
