import { History, PackagePlus, PencilLine } from "lucide-react";
import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { getStock } from "../../api/endpoints.js";
import BranchPicker from "../../components/BranchPicker.jsx";
import { LowStockBanner, StockList } from "../../components/StockStatus.jsx";
import { ErrorNotice, Loading, Notice } from "../../components/ui/Feedback.jsx";
import { PageHeader, Section, Tile } from "../../components/ui/Layout.jsx";
import { useBranchScope } from "../../context/BranchContext.jsx";
import { useLoad } from "../../hooks/useLoad.js";
import { useT } from "../../i18n/LanguageContext.jsx";

/** Stock menu: three big jobs on top, the current stock below. */
export default function StockHome() {
  const { t } = useT();
  const scope = useBranchScope("work");
  const { state } = useLocation(); // a sub-page may send back a "Saved" message

  const loader = useCallback(() => getStock(scope.params), [scope.params]);
  const { data: rows, error } = useLoad(loader, { enabled: scope.ready });

  return (
    <div className="space-y-6">
      <PageHeader title={t("stock.title")}>
        <BranchPicker scope={scope} />
      </PageHeader>
      <Notice notice={state?.notice} />
      <ErrorNotice error={scope.error || error} />

      <div className="grid gap-3 md:grid-cols-3">
        <Tile to="/stock/arrived" icon={PackagePlus} title={t("stock.arrived")} hint={t("stock.arrivedHint")} />
        <Tile to="/stock/correct" icon={PencilLine} title={t("stock.correct")} hint={t("stock.correctHint")} />
        <Tile to="/stock/history" icon={History} title={t("stock.history")} hint={t("stock.historyHint")} />
      </div>

      <Section title={t("stock.now")}>
        {rows ? (
          <>
            <LowStockBanner rows={rows} />
            <StockList rows={rows} />
          </>
        ) : (
          !error && <Loading />
        )}
      </Section>
    </div>
  );
}
