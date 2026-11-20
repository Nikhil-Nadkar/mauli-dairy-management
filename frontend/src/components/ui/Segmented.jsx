import { Check } from "lucide-react";

/**
 * A row of big buttons where exactly one is chosen (branch, period, language, add/remove…).
 * The chosen one is filled in dark and shows a tick, so it is clear even without colour vision.
 *
 *   <Segmented label="Branch" options={[{ value: 1, label: "Branch 1" }]} value={id} onChange={setId} />
 */
export default function Segmented({ label, options, value, onChange, columns }) {
  const layout = columns ? `grid gap-2 ${columns}` : "flex flex-wrap gap-2";
  return (
    <div role="group" aria-label={label} className={layout}>
      {options.map((o) => {
        const chosen = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={chosen}
            onClick={() => onChange(o.value)}
            className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 text-lg font-bold ${
              columns ? "px-3" : "px-5"
            } ${
              chosen
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-900 hover:border-slate-500"
            }`}
          >
            {chosen && <Check aria-hidden="true" className="h-6 w-6 shrink-0" strokeWidth={3} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
