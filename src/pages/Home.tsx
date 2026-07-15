import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { claimTicket, getTicket, useDemoStore } from "../store/demo";
import type { IssuedTicket } from "../store/demo";

function TicketRow({ ticket }: { ticket: IssuedTicket }) {
  const { t, formatNumber } = useI18n();
  const info = getTicket(ticket.ticketId);
  const done = ticket.completedAt !== null;
  const started = ticket.zones.some(Boolean);
  const status = done ? t("statusDone") : started ? t("statusScratching") : t("statusNew");

  return (
    <Link to={`/ticket/${ticket.ticketId}`} className="ticket-row">
      <div>
        <strong className="mono">{info.displayNo}</strong>
        <span className={`status ${done ? "done" : started ? "active" : "new"}`}>{status}</span>
      </div>
      <div className="ticket-row-right">
        {done ? (
          <strong className={info.finalPayout > 0 ? "win-amount" : "muted"}>
            {info.finalPayout > 0
              ? `+${formatNumber(info.finalPayout)} ${t("tokens")}`
              : t("resultLose")}
          </strong>
        ) : (
          <span className="muted">{t("continueScratch")} →</span>
        )}
      </div>
    </Link>
  );
}

export function Home() {
  const { t, formatNumber } = useI18n();
  const state = useDemoStore();
  const navigate = useNavigate();
  const pending = state.issued.filter((i) => i.completedAt === null);

  const onClaim = () => {
    try {
      const issued = claimTicket();
      navigate(`/ticket/${issued.ticketId}`);
    } catch (err) {
      alert(err instanceof Error && err.message === "paused" ? t("activityPaused") : t("soldOut"));
    }
  };

  return (
    <main className="page">
      <header className="hero">
        <div className="brand-row">
          <div className="tf-mark">TF</div>
          <div>
            <div className="eyebrow">{t("brandTagline")}</div>
            <h1>{t("title")}</h1>
          </div>
        </div>
        <p className="tagline">{t("subtitle")}</p>
        <p className="max-prize">
          {t("maxPrize")} <strong>100,000</strong> {t("tokens")}
        </p>
      </header>

      <section className="wallet">
        <div>
          <span className="label">{t("balance")}</span>
          <strong className="balance">
            {formatNumber(state.balance)} <em>{t("tokens")}</em>
          </strong>
        </div>
        <div>
          <span className="label">{t("totalStats")}</span>
          <strong>{formatNumber(state.totalWon)}</strong>
        </div>
      </section>

      <button className="primary-btn claim-btn" onClick={onClaim}>
        {t("claim")}
      </button>

      <section className="rules">
        <div>
          <strong>{t("ruleMatch")}</strong>
          <span>{t("ruleMatchDesc")}</span>
        </div>
        <div>
          <strong>{t("ruleTf")}</strong>
          <span>{t("ruleTfDesc")}</span>
        </div>
        <div>
          <strong>{t("ruleStack")}</strong>
          <span>{t("ruleStackDesc")}</span>
        </div>
      </section>

      <section className="ticket-list">
        <div className="list-header">
          <h2>{t("myTickets")}</h2>
          <Link to="/history" className="muted">
            {t("history")} →
          </Link>
        </div>
        {state.issued.length === 0 && <p className="muted empty">{t("emptyTickets")}</p>}
        {pending.map((ticket) => (
          <TicketRow key={ticket.ticketId} ticket={ticket} />
        ))}
        {state.issued
          .filter((i) => i.completedAt !== null)
          .slice(0, 5)
          .map((ticket) => (
            <TicketRow key={ticket.ticketId} ticket={ticket} />
          ))}
      </section>

      <footer className="demo-badge">
        {t("demoBadge")} · <Link to="/admin">{t("adminConsole")}</Link>
      </footer>
    </main>
  );
}
