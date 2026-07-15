import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { getTicket, useDemoStore } from "../store/demo";

function formatTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function History() {
  const { t, locale, formatNumber } = useI18n();
  const state = useDemoStore();
  const completed = state.issued
    .filter((i) => i.completedAt !== null)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  return (
    <main className="page">
      <header className="ticket-header">
        <Link to="/" className="ghost-btn back-btn">
          ← {t("backHome")}
        </Link>
        <h2>{t("history")}</h2>
        <div />
      </header>

      {completed.length === 0 && <p className="muted empty">{t("emptyHistory")}</p>}

      <section className="history-list">
        {completed.map((issued) => {
          const ticket = getTicket(issued.ticketId);
          return (
            <Link to={`/ticket/${issued.ticketId}`} className="history-row" key={issued.ticketId}>
              <div className="history-main">
                <strong className="mono">{ticket.displayNo}</strong>
                <span className="muted">
                  {t("issuedAt")} {formatTime(issued.issuedAt, locale)} · {t("completedAt")}{" "}
                  {issued.completedAt ? formatTime(issued.completedAt, locale) : "-"}
                </span>
              </div>
              <div className="history-right">
                <strong className={ticket.finalPayout > 0 ? "win-amount" : "muted"}>
                  {ticket.finalPayout > 0
                    ? `+${formatNumber(ticket.finalPayout)} ${t("tokens")}`
                    : "0"}
                </strong>
                <span className="muted small">
                  {t("rewardStatus")}: {issued.credited ? t("rewardCredited") : t("rewardPending")}
                </span>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
