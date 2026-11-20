import { AlertTriangle, BarChart3 } from "lucide-react";
import { useCallback } from "react";
import { getLowStock, getSummary } from "../api/endpoints.js";
import BranchPicker from "../components/BranchPicker.jsx";
import { DailySalesChart } from "../components/Charts.jsx";
import { ButtonLink } from "../components/ui/Button.jsx";
import { ErrorNotice, Loading } from "../components/ui/Feedback.jsx";
import { PageHeader } from "../components/ui/Layout.jsx";
import StatCard, { GrossProfitNote } from "../components/ui/StatCard.jsx";
import { useBranchScope } from "../context/BranchContext.jsx";
import { useLoad } from "../hooks/useLoad.js";
import { useT } from "../i18n/LanguageContext.jsx";

/** Owner's home: today's numbers, what to re-order, and the last 7 days. */
export default function Dashboard() {
  const { t } = useT();
  const scope = useBranchScope("view");

  const loader = useCallback(async () => {
    const [today, week, lowStock] = await Promise.all([
      getSummary({ ...scope.params, range: "today" }),
      getSummary({ ...scope.params, range: "7d" }),
      getLowStock(scope.params),
    ]);
    return { today, week, lowStock };
  }, [scope.params]);
  const { data, error } = useLoad(loader, { enabled: scope.ready });

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard.title")}>
        <BranchPicker scope={scope} />
      </PageHeader>
      <ErrorNotice error={scope.error || error} />

      {!data ? (
        !error && <Loading />
      ) : (
        <>
          <TodayCards totals={data.today.totals} lowStockCount={data.lowStock.length} />
          <ReorderList items={data.lowStock} showBranch={scope.branchId === null} />
          <DailySalesChart daily={data.week.daily} title={t("dashboard.last7")} />
          <ButtonLink to="/reports" icon={BarChart3} size="lg">
            {t("dashboard.fullReports")}
          </ButtonLink>
        </>
      )}
    </div>
  );
}

function TodayCards({ totals, lowStockCount }) {
  const { t, fmt } = useT();
  return (
    <section aria-label={t("dashboard.todayRegion")} className="space-y-3">
      <h2 className="text-2xl font-bold">{t("dashboard.today")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t("dashboard.todaySales")} value={fmt.rupees(totals.total_sales)} />
        <StatCard label={t("dashboard.grossProfit")} value={fmt.rupees(totals.gross_profit)} tone="good" />
        <StatCard label={t("dashboard.salesCount")} value={totals.sales_count} />
        <StatCard label={t("dashboard.itemsSold")} value={totals.items_sold} hint={t("dashboard.itemsSoldHint")} />
        <StatCard
          label={t("dashboard.lowStock")}
          value={lowStockCount}
          tone={lowStockCount ? "warn" : "default"}
          hint={lowStockCount ? t("dashboard.lowStockSome") : t("dashboard.lowStockNone")}
        />
      </div>
      <GrossProfitNote />
    </section>
  );
}

function ReorderList({ items, showBranch }) {
  const { t, fmt } = useT();
  if (items.length === 0) return null;
  return (
    <section
      aria-label={t("dashboard.lowRegion")}
      className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-4 text-amber-950"
    >
      <h2 className="mb-2 flex items-center gap-2 text-2xl font-bold">
        <AlertTriangle aria-hidden="true" className="h-7 w-7" />
        {t("dashboard.reorder")}
      </h2>
      <ul className="space-y-1 text-xl">
        {items.map((l) => (
          <li key={`${l.branch_id}-${l.product_id}`}>
            <span className="font-bold">{l.name}</span>
            {showBranch && ` (${l.branch_name})`} –{" "}
            {l.status === "out_of_stock"
              ? t("status.out_of_stock")
              : t("sale.onlyLeft", { qty: fmt.qty(l.available, l.base_unit) })}
          </li>
        ))}
      </ul>
    </section>
  );
}
