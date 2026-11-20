import { AlertTriangle } from "lucide-react";
import { useT } from "../i18n/LanguageContext.jsx";
import Badge from "./ui/Badge.jsx";
import { EmptyState } from "./ui/Feedback.jsx";

const STATUS_TONE = { in_stock: "good", low: "warn", out_of_stock: "bad" };

export function StatusBadge({ status }) {
  const { t } = useT();
  return <Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>;
}

/** One card per product: name, how much is left (big), and its status. */
export function StockList({ rows }) {
  const { t, fmt } = useT();
  if (rows.length === 0) return <EmptyState>{t("stock.noProducts")}</EmptyState>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <li
          key={r.product_id}
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="min-w-0">
            <p className="text-xl font-extrabold">
              {r.name}{" "}
              {!r.is_active && <span className="text-base font-normal text-slate-700">{t("stock.hidden")}</span>}
            </p>
            <StatusBadge status={r.status} />
          </div>
          <p className="whitespace-nowrap text-2xl font-extrabold">{fmt.qty(r.available, r.base_unit)}</p>
        </li>
      ))}
    </ul>
  );
}

/** Yellow box listing products that are low or out of stock. Hidden when everything is fine. */
export function LowStockBanner({ rows }) {
  const { t, fmt } = useT();
  const attention = rows.filter((r) => r.is_active && r.status !== "in_stock");
  if (attention.length === 0) return null;
  return (
    <div className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-4 text-amber-950">
      <p className="mb-2 flex items-center gap-2 text-xl font-extrabold">
        <AlertTriangle aria-hidden="true" className="h-7 w-7" />
        {t("stock.checkThese")}
      </p>
      <ul className="space-y-1 text-lg">
        {attention.map((r) => (
          <li key={r.product_id}>
            <span className="font-bold">{r.name}</span> –{" "}
            {r.status === "out_of_stock"
              ? t("stock.outOfStockLower")
              : t("stock.onlyLeft", { qty: fmt.qty(r.available, r.base_unit) })}
          </li>
        ))}
      </ul>
    </div>
  );
}
