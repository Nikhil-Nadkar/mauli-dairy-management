import { Check } from "lucide-react";
import { useState } from "react";
import QuickButtonsEditor from "../../components/QuickButtonsEditor.jsx";
import Button from "../../components/ui/Button.jsx";
import { Field, NumberInput, TextInput } from "../../components/ui/Form.jsx";
import Segmented from "../../components/ui/Segmented.jsx";
import { useT } from "../../i18n/LanguageContext.jsx";

const DEFAULT_BUTTONS = {
  litre: [
    { label: "250 ml", quantity: "0.250" },
    { label: "500 ml", quantity: "0.500" },
    { label: "1 litre", quantity: "1.000" },
  ],
  kg: [
    { label: "250 g", quantity: "0.250" },
    { label: "500 g", quantity: "0.500" },
    { label: "1 kg", quantity: "1.000" },
  ],
};

export const NEW_PRODUCT = {
  name: "",
  base_unit: "litre",
  quick_quantities: DEFAULT_BUTTONS.litre,
  low_stock_threshold: "5",
};

/** Name, unit, quick buttons and low-stock warning. Used both to add a product and to change one. */
export default function ProductForm({ initial, submitText, busy, isNew, onSubmit }) {
  const { t, fmt } = useT();
  const [form, setForm] = useState(initial);
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  // A new unit means the old quick buttons no longer make sense.
  const changeUnit = (unit) => setForm((f) => ({ ...f, base_unit: unit, quick_quantities: DEFAULT_BUTTONS[unit] }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <Field label={t("product.name")}>
        <TextInput required value={form.name} onChange={(e) => set("name")(e.target.value)} />
      </Field>

      <div className="space-y-2">
        <p className="text-lg font-bold">{t("product.soldBy")}</p>
        <Segmented
          label={t("product.soldBy")}
          columns="grid-cols-2"
          options={[
            { value: "litre", label: t("product.litre") },
            { value: "kg", label: t("product.kg") },
          ]}
          value={form.base_unit}
          onChange={changeUnit}
        />
        {!isNew && <p className="text-base text-slate-700">{t("product.unitLocked")}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-lg font-bold">{t("product.quickButtons")}</p>
        <p className="text-base text-slate-700">{t("product.quickHint")}</p>
        <QuickButtonsEditor
          baseUnit={form.base_unit}
          value={form.quick_quantities}
          onChange={set("quick_quantities")}
        />
      </div>

      <Field label={t("product.threshold")}>
        <NumberInput
          unit={fmt.unitLong(form.base_unit)}
          value={form.low_stock_threshold}
          onChange={(e) => set("low_stock_threshold")(e.target.value)}
          className="max-w-72"
        />
      </Field>

      <Button type="submit" variant="success" size="lg" icon={Check} full busy={busy} busyText={t("common.saving")}>
        {submitText}
      </Button>
    </form>
  );
}
