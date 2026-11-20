import { useCallback } from "react";
import { getSales } from "../../api/endpoints.js";
import Button from "../../components/ui/Button.jsx";
import { EmptyState, ErrorNotice, Loading } from "../../components/ui/Feedback.jsx";
import { Card, Section } from "../../components/ui/Layout.jsx";
import { usePagedList } from "../../hooks/useLoad.js";
import { useT } from "../../i18n/LanguageContext.jsx";

/** Every sale in the chosen period, newest first, 15 at a time. */
export default function SalesRecords({ branchParams, dateFrom, dateTo }) {
  const { t, fmt } = useT();
  const fetchPage = useCallback(
    (page) => getSales({ ...branchParams, date_from: dateFrom, date_to: dateTo, ...page }),
    [branchParams, dateFrom, dateTo]
  );
  const sales = usePagedList(fetchPage, { pageSize: 15 });

  return (
    <Section title={t("report.records")}>
      <ErrorNotice error={sales.error} />
      {!sales.loaded ? (
        !sales.error && <Loading />
      ) : sales.items.length === 0 ? (
        <EmptyState>{t("report.noSales")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {sales.items.map((s) => (
            <Card as="li" key={s.id} className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold">
                  {fmt.dateTime(s.created_at)} · {s.branch_name}
                </p>
                <p className="text-lg text-slate-800">
                  {s.items.map((i) => `${i.product_name} ${fmt.qty(i.quantity, i.base_unit)}`).join(", ")}
                </p>
                <p className="text-base text-slate-700">{t("report.soldBy", { name: s.user_name })}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold">{fmt.rupees(s.total_amount)}</p>
                <p className="text-base font-semibold text-green-800">
                  {t("report.profit", { amount: fmt.rupees(s.profit) })}
                </p>
              </div>
            </Card>
          ))}
        </ul>
      )}
      {sales.hasMore && (
        <Button
          variant="secondary"
          size="lg"
          full
          busy={sales.loadingMore}
          busyText={t("common.loading")}
          onClick={sales.showMore}
        >
          {t("report.older")}
        </Button>
      )}
    </Section>
  );
}
