import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { I18nProvider, useI18n } from "./i18n";
import { History } from "./pages/History";
import { Home } from "./pages/Home";
import { TicketPage } from "./pages/TicketPage";

function LangToggle() {
  const { t, toggle } = useI18n();
  return (
    <button className="ghost-btn lang-toggle" onClick={toggle}>
      {t("langSwitch")}
    </button>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <LangToggle />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ticket/:id" element={<TicketPage />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </I18nProvider>
  );
}
