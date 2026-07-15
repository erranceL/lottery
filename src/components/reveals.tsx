import type { CellSymbol } from "../engine/tickets";
import { useI18n } from "../i18n";

export function DirectionReveal({ symbol }: { symbol: CellSymbol }) {
  const { t } = useI18n();
  if (symbol === "tf") {
    return (
      <div className="reveal tf">
        <span className="main">TF</span>
        <span className="sub">{t("tfBonus")}</span>
      </div>
    );
  }
  if (symbol === "up") {
    return (
      <div className="reveal up">
        <span className="main">↑ {t("up")}</span>
        <span className="sub">{t("higher")}</span>
      </div>
    );
  }
  return (
    <div className="reveal down">
      <span className="main">↓ {t("down")}</span>
      <span className="sub">{t("lower")}</span>
    </div>
  );
}

export function PrizeReveal({ value, winning }: { value: number; winning: boolean }) {
  const { t } = useI18n();
  return (
    <div className={`reveal prize${winning ? " winning" : ""}`}>
      <span className="main">{value.toLocaleString()}</span>
      <span className="sub">{t("tokens")}</span>
    </div>
  );
}
