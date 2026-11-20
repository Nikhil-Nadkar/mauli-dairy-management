import { useT } from "../../i18n/LanguageContext.jsx";
import { milliInCart } from "../../utils/cart.js";

const LOW_STOCK_MILLI = 5000; // warn on the card when 5 L / 5 kg or less is left

/** Step 1 of a sale: big product cards. Products that cannot be sold are greyed out and say why. */
export default function ProductGrid({ products, stock, cart, chosenId, onChoose }) {
  const { t, fmt } = useT();

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {products.map((p) => {
        const available = stock[p.id] ?? 0;
        const inBill = milliInCart(cart, p.id);
        const outOfStock = available <= 0;
        const noPrice = p.selling_price === null;
        const allInBill = !outOfStock && available - inBill <= 0;
        const disabled = outOfStock || noPrice || allInBill;
        const low = !disabled && available <= LOW_STOCK_MILLI;

        return (
          <li key={p.id}>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={chosenId === p.id}
              onClick={() => onChoose(p.id)}
              className={`flex h-full min-h-36 w-full flex-col items-center justify-center gap-1 rounded-2xl border-4 p-3 text-center shadow-sm ${
                disabled
                  ? "border-slate-200 bg-slate-200 text-slate-700"
                  : "border-slate-200 bg-white hover:border-sky-500 active:bg-sky-50"
              } ${chosenId === p.id ? "border-sky-700 bg-sky-50" : ""}`}
            >
              <span className="text-2xl font-extrabold leading-tight">{p.name}</span>
              {noPrice ? (
                <span className="text-lg font-bold">{t("sale.priceNotSet")}</span>
              ) : (
                <span className="text-xl text-slate-800">{fmt.pricePerUnit(p.selling_price, p.base_unit)}</span>
              )}
              {outOfStock && (
                <span className="rounded-full bg-red-700 px-3 py-0.5 text-base font-extrabold text-white">
                  {t("status.out_of_stock")}
                </span>
              )}
              {allInBill && <span className="text-base font-bold">{t("sale.allInBill")}</span>}
              {low && (
                <span className="text-base font-bold text-amber-800">
                  {t("sale.onlyLeft", { qty: fmt.qty(available / 1000, p.base_unit) })}
                </span>
              )}
              {inBill > 0 && !allInBill && (
                <span className="rounded-full bg-green-100 px-3 py-0.5 text-base font-bold text-green-900">
                  {t("sale.inBill", { qty: fmt.qty(inBill / 1000, p.base_unit) })}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
