import { IndianRupee } from "lucide-react";
import { useState } from "react";
import Button from "../../components/ui/Button.jsx";
import { Field, NumberInput } from "../../components/ui/Form.jsx";
import { useT } from "../../i18n/LanguageContext.jsx";

/** Price boxes as text, per branch: { [branchId]: { selling: "60", cost: "45" } } */
function pricesAsText(product, branches) {
  return Object.fromEntries(
    branches.map((b) => {
      const price = product.prices.find((p) => p.branch_id === b.id);
      return [
        b.id,
        {
          selling: price ? String(Number(price.selling_price)) : "",
          cost: price ? String(Number(price.cost_price)) : "",
        },
      ];
    })
  );
}

/** Selling and cost price for each branch. A branch left completely empty is skipped. */
export default function PriceEditor({ product, branches, busy, onSave, onError }) {
  const { t, fmt } = useT();
  const [draft, setDraft] = useState(() => pricesAsText(product, branches));
  const unit = fmt.unitShort(product.base_unit);

  const setPrice = (branchId, field) => (e) =>
    setDraft((d) => ({ ...d, [branchId]: { ...d[branchId], [field]: e.target.value } }));

  function save() {
    const prices = [];
    for (const b of branches) {
      const { selling, cost } = draft[b.id];
      if (selling === "" && cost === "") continue; // this branch is not priced yet
      if (selling === "" || cost === "") return onError(t("product.errBoth", { branch: b.name }));
      prices.push({ branch_id: b.id, selling_price: selling, cost_price: cost });
    }
    if (prices.length === 0) return onError(t("product.errNone"));
    onSave(prices);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {branches.map((b) => {
          const d = draft[b.id];
          const sellingBelowCost = d.selling !== "" && d.cost !== "" && Number(d.selling) < Number(d.cost);
          return (
            <div key={b.id} className="space-y-3 rounded-2xl border-2 border-slate-200 p-4">
              <h3 className="text-xl font-extrabold">{b.name}</h3>
              <Field label={t("product.selling", { unit })}>
                <NumberInput step="0.01" value={d.selling} onChange={setPrice(b.id, "selling")} />
              </Field>
              <Field label={t("product.costPrice", { unit })}>
                <NumberInput step="0.01" value={d.cost} onChange={setPrice(b.id, "cost")} />
              </Field>
              {sellingBelowCost && <p className="text-lg font-bold text-amber-800">{t("product.lowMargin")}</p>}
            </div>
          );
        })}
      </div>
      <Button size="lg" icon={IndianRupee} full busy={busy} busyText={t("common.saving")} onClick={save}>
        {t("product.savePrices")}
      </Button>
      <p className="text-base text-slate-700">{t("product.pricesNote")}</p>
    </div>
  );
}
