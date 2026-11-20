import { Check, Plus, Trash2 } from "lucide-react";
import Button from "../../components/ui/Button.jsx";
import Sheet from "../../components/ui/Sheet.jsx";
import { useT } from "../../i18n/LanguageContext.jsx";
import { formatPaise, lineTotalPaise } from "../../utils/cart.js";

/**
 * Step 3 of a sale: read the bill once more, then save. This is the "are you sure?" step,
 * so a wrong tap on a product never becomes a saved sale by itself.
 */
export default function BillSheet({ cart, stock, totalPaise, busy, onRemove, onSave, onClose }) {
  const { t, fmt } = useT();
  const overStock = (line) => line.milli > (stock[line.product_id] ?? 0);
  const canSave = cart.length > 0 && !cart.some(overStock);

  return (
    <Sheet title={t("sale.billTitle")} onClose={onClose}>
      <ul aria-label={t("sale.billTitle")} className="divide-y-2 divide-slate-100">
        {cart.map((line) => (
          <li key={line.product_id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-2xl font-extrabold">{line.name}</p>
              <p className="text-xl text-slate-800">{fmt.qty(line.milli / 1000, line.base_unit)}</p>
              {overStock(line) && (
                <p className="text-lg font-bold text-red-800">
                  {t("sale.overStock", { qty: fmt.qty((stock[line.product_id] ?? 0) / 1000, line.base_unit) })}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-2xl font-extrabold">{formatPaise(lineTotalPaise(line.milli, line.price))}</span>
              <Button
                variant="dangerSoft"
                icon={Trash2}
                aria-label={t("sale.removeName", { name: line.name })}
                onClick={() => onRemove(line.product_id)}
              >
                {t("sale.remove")}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="my-4 flex items-center justify-between rounded-2xl bg-slate-100 p-4 text-3xl font-extrabold">
        <span>{t("sale.total")}</span>
        <span data-testid="bill-total">{formatPaise(totalPaise)}</span>
      </div>

      <div className="grid gap-3">
        <Button
          variant="success"
          size="xl"
          icon={Check}
          full
          disabled={!canSave}
          busy={busy}
          busyText={t("common.saving")}
          onClick={onSave}
        >
          {t("sale.saveSale")}
        </Button>
        <Button variant="secondary" size="lg" icon={Plus} full onClick={onClose}>
          {t("sale.addMore")}
        </Button>
      </div>
    </Sheet>
  );
}
