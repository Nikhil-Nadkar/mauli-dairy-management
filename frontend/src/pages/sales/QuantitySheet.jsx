import { Plus } from "lucide-react";
import { useState } from "react";
import Button from "../../components/ui/Button.jsx";
import { Field, NumberInput } from "../../components/ui/Form.jsx";
import Sheet from "../../components/ui/Sheet.jsx";
import { useT } from "../../i18n/LanguageContext.jsx";
import { formatPaise, lineTotalPaise, toMilli } from "../../utils/cart.js";

/** Step 2 of a sale: how much of the chosen product? Big quick buttons, or type another amount. */
export default function QuantitySheet({ product, remainingMilli, onAdd, onClose }) {
  const { t, fmt } = useT();
  const [otherAmount, setOtherAmount] = useState("");
  const [error, setError] = useState("");
  const qty = (milli) => fmt.qty(milli / 1000, product.base_unit);

  function addOther() {
    const milli = toMilli(otherAmount);
    if (!(milli > 0)) return setError(t("sale.errAmountZero"));
    if (Math.abs(Number(otherAmount) * 1000 - milli) > 1e-6) return setError(t("sale.errDecimals"));
    if (milli > remainingMilli) {
      return setError(t("sale.errNotEnough", { name: product.name, qty: qty(remainingMilli) }));
    }
    onAdd(milli);
  }

  return (
    <Sheet title={t("sale.howMuch", { name: product.name })} onClose={onClose}>
      <p className="mb-4 text-xl text-slate-800">{fmt.pricePerUnit(product.selling_price, product.base_unit)}</p>

      <div className="grid grid-cols-2 gap-3">
        {product.quick_quantities.map((q) => {
          const milli = toMilli(q.quantity);
          const enough = milli <= remainingMilli;
          const label = fmt.quickLabel(q, product.base_unit);
          return (
            <button
              key={q.quantity}
              type="button"
              disabled={!enough}
              onClick={() => onAdd(milli)}
              className={`min-h-28 rounded-2xl px-2 py-2 text-2xl font-extrabold leading-tight ${
                enough ? "bg-sky-700 text-white hover:bg-sky-800 active:bg-sky-900" : "bg-slate-200 text-slate-600"
              }`}
            >
              {label.main}
              {label.detail && <span className="block text-lg font-bold">{label.detail}</span>}
              <span className="mt-1 block text-lg font-semibold">
                {enough ? formatPaise(lineTotalPaise(milli, product.selling_price)) : t("sale.notEnoughStock")}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 space-y-3 border-t-2 border-slate-200 pt-5">
        <Field label={t("sale.otherAmount", { unit: fmt.unitLong(product.base_unit) })}>
          <NumberInput
            value={otherAmount}
            onChange={(e) => (setOtherAmount(e.target.value), setError(""))}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOther())}
          />
        </Field>
        {error && (
          <p role="alert" className="text-xl font-bold text-red-800">
            {error}
          </p>
        )}
        <Button variant="dark" size="lg" icon={Plus} full onClick={addOther}>
          {t("common.add")}
        </Button>
      </div>
    </Sheet>
  );
}
