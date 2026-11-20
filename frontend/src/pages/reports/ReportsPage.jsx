import { useCallback, useMemo, useState } from "react";
import { getSummary } from "../../api/endpoints.js";
import BranchPicker from "../../components/BranchPicker.jsx";
import { BranchBarChart, DailySalesChart, ProductPieChart } from "../../components/Charts.jsx";
import { ErrorNotice, Loading } from "../../components/ui/Feedback.jsx";
import { Field, TextInput } from "../../components/ui/Form.jsx";
import { PageHeader, Section } from "../../components/ui/Layout.jsx";
import Segmented from "../../components/ui/Segmented.jsx";
import StatCard, { GrossProfitNote } from "../../components/ui/StatCard.jsx";
import { useBranchScope } from "../../context/BranchContext.jsx";
import { useLoad } from "../../hooks/useLoad.js";
import { useT } from "../../i18n/LanguageContext.jsx";
import { BranchSales, ProductSales } from "./ReportTables.jsx";
import SalesRecords from "./SalesRecords.jsx";

const RANGES = ["today", "7d", "21d", "3m", "custom"];

/** Owner's reports: choose branch and period, then totals, charts, tables and every sale. */
export default function ReportsPage() {
  const { t, fmt } = useT();
  const scope = useBranchScope("view");
  const [range, setRange] = useState("7d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const waitingForDates = range === "custom" && (!custom.from || !custom.to);

  const params = useMemo(
    () =>
      range === "custom"
        ? { range, ...scope.params, date_from: custom.from, date_to: custom.to }
        : { range, ...scope.params },
    [range, custom, scope.params]
  );
  const loader = useCallback(() => getSummary(params), [params]);
  const { data: summary, error, loading } = useLoad(loader, { enabled: scope.ready && !waitingForDates });
  const allBranches = scope.branchId === null;

  return (
    <div className="space-y-6">
      <PageHeader title={t("report.title")}>
        <BranchPicker scope={scope} />
        <Segmented
          label={t("report.period")}
          columns="grid-cols-2 sm:grid-cols-5"
          options={RANGES.map((key) => ({ value: key, label: t(`report.${key}`) }))}
          value={range}
          onChange={setRange}
        />
        {range === "custom" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("report.from")}>
              <TextInput
                type="date"
                value={custom.from}
                max={custom.to || undefined}
                onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              />
            </Field>
            <Field label={t("report.to")}>
              <TextInput
                type="date"
                value={custom.to}
                min={custom.from || undefined}
                onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              />
            </Field>
          </div>
        )}
      </PageHeader>

      <ErrorNotice error={scope.error || error} />
      {waitingForDates ? (
        <p className="text-xl text-slate-800">{t("report.chooseBoth")}</p>
      ) : !summary ? (
        !error && <Loading />
      ) : (
        <div className={`space-y-8 ${loading ? "opacity-60" : ""}`}>
          <p className="text-xl font-semibold text-slate-800">
            {summary.date_from === summary.date_to
              ? fmt.day(summary.date_from)
              : `${fmt.day(summary.date_from)} – ${fmt.day(summary.date_to)}`}
          </p>

          <Section label={t("report.totals")}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label={t("report.totalSales")} value={fmt.rupees(summary.totals.total_sales)} />
              <StatCard label={t("report.totalCost")} value={fmt.rupees(summary.totals.total_cost)} />
              <StatCard label={t("report.grossProfit")} value={fmt.rupees(summary.totals.gross_profit)} tone="good" />
              <StatCard label={t("report.salesCount")} value={summary.totals.sales_count} />
            </div>
            <GrossProfitNote />
          </Section>

          <DailySalesChart daily={summary.daily} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ProductPieChart products={summary.products} />
            {allBranches && <BranchBarChart branches={summary.branches} />}
          </div>

          <ProductSales products={summary.products} />
          {allBranches && <BranchSales branches={summary.branches} />}
          <SalesRecords branchParams={scope.params} dateFrom={summary.date_from} dateTo={summary.date_to} />
        </div>
      )}
    </div>
  );
}
