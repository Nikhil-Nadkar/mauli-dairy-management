import { useCallback } from "react";
import { getStockHistory } from "../../api/endpoints.js";
import BranchPicker from "../../components/BranchPicker.jsx";
import Button from "../../components/ui/Button.jsx";
import { EmptyState, ErrorNotice, Loading } from "../../components/ui/Feedback.jsx";
import { PageHeader } from "../../components/ui/Layout.jsx";
import { useBranchScope } from "../../context/BranchContext.jsx";
import { usePagedList } from "../../hooks/useLoad.js";
import { useT } from "../../i18n/LanguageContext.jsx";
import { showReason } from "./reasons.js";

/** Every change to the stock, newest first. */
export default function StockHistory() {
  const { t, fmt } = useT();
  const scope = useBranchScope("work");
  const fetchPage = useCallback((page) => getStockHistory({ ...scope.params, ...page }), [scope.params]);
  const history = usePagedList(fetchPage, { enabled: scope.ready, pageSize: 20 });

  return (
    <div className="space-y-5">
      <PageHeader title={t("stock.history")} backTo="/stock">
        <BranchPicker scope={scope} />
      </PageHeader>
      <ErrorNotice error={scope.error || history.error} />

      {!history.loaded ? (
        !history.error && <Loading />
      ) : history.items.length === 0 ? (
        <EmptyState>{t("stock.historyEmpty")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {history.items.map((m) => {
            const change = Number(m.quantity_change);
            return (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-xl font-extrabold">{m.product_name}</p>
                  <p className="text-lg text-slate-800">
                    {t(`movement.${m.movement_type}`)}
                    {m.reason ? ` – ${showReason(m.reason, t)}` : ""}
                  </p>
                  <p className="text-base text-slate-700">
                    {fmt.dateTime(m.created_at)} · {m.user_name}
                  </p>
                </div>
                <p
                  className={`whitespace-nowrap text-2xl font-extrabold ${change > 0 ? "text-green-800" : "text-red-800"}`}
                >
                  {change > 0 ? "+" : "−"}
                  {fmt.qty(Math.abs(change), m.base_unit)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {history.hasMore && (
        <Button
          variant="secondary"
          size="lg"
          full
          busy={history.loadingMore}
          busyText={t("common.loading")}
          onClick={history.showMore}
        >
          {t("stock.older")}
        </Button>
      )}
    </div>
  );
}
