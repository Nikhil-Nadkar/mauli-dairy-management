import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useT } from "../i18n/LanguageContext.jsx";
import { QUICK_UNITS, makeQuickButton } from "../utils/format.js";
import Button from "./ui/Button.jsx";
import { inputClass } from "./ui/Form.jsx";
import Segmented from "./ui/Segmented.jsx";

const MAX_BUTTONS = 8;
const UNIT_TEXT = {
  en: { ml: "ml", litre: "litre", g: "g", kg: "kg" },
  mr: { ml: "मि.ली.", litre: "लिटर", g: "ग्रॅ.", kg: "किलो" },
};

/** Lets the owner add/remove the quick amount buttons without thinking about base units. */
export default function QuickButtonsEditor({ value, onChange, baseUnit }) {
  const { t, lang, fmt } = useT();
  const units = QUICK_UNITS[baseUnit];
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState(units[0]);
  const [error, setError] = useState("");

  // If the product unit changes (litre <-> kg), the unit choice must follow.
  const validUnit = units.includes(unit) ? unit : units[0];

  function add() {
    const result = makeQuickButton(amount, validUnit);
    if (result.error) return setError(t(result.error));
    if (value.length >= MAX_BUTTONS) return setError(t("product.quickMax"));
    if (value.some((q) => q.quantity === result.quantity)) return setError(t("product.quickExists"));
    onChange([...value, result].sort((a, b) => Number(a.quantity) - Number(b.quantity)));
    setAmount("");
    setError("");
  }

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2">
        {value.length === 0 && <li className="text-lg text-slate-700">{t("product.quickNone")}</li>}
        {value.map((q) => {
          const { main, detail } = fmt.quickLabel(q, baseUnit);
          const label = detail ? `${main} (${detail})` : main;
          return (
            <li
              key={q.quantity}
              className="flex items-center gap-2 rounded-full border-2 border-sky-300 bg-sky-50 py-1 pl-4 pr-1 text-lg font-bold text-sky-950"
            >
              {label}
              <button
                type="button"
                aria-label={t("product.quickRemove", { label })}
                onClick={() => onChange(value.filter((x) => x.quantity !== q.quantity))}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-red-700 hover:bg-red-100"
              >
                <X aria-hidden="true" className="h-6 w-6" strokeWidth={3} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
        <label className="block">
          <span className="mb-2 block text-lg font-bold">{t("product.quickAmount")}</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="250"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            className={`${inputClass} max-w-48`}
          />
        </label>
        <Segmented
          label={t("product.quickUnit")}
          options={units.map((u) => ({ value: u, label: (UNIT_TEXT[lang] ?? UNIT_TEXT.en)[u] }))}
          value={validUnit}
          onChange={setUnit}
        />
        <Button variant="dark" icon={Plus} onClick={add}>
          {t("product.quickAdd")}
        </Button>
        {error && (
          <p role="alert" className="text-lg font-bold text-red-800">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
