// Form pieces. Labels are always written ABOVE the box in bold - never only as grey placeholder text.

export const inputClass =
  "min-h-14 w-full rounded-xl border-2 border-slate-400 bg-white px-4 text-xl text-slate-900 " +
  "placeholder:text-slate-500 focus:border-sky-700 focus:outline-none";

/** <Field label="Product name" hint="..."><TextInput .../></Field> */
export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-lg font-bold text-slate-900">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-base text-slate-700">{hint}</span>}
    </label>
  );
}

export function TextInput({ className = "", ...props }) {
  return <input type="text" className={`${inputClass} ${className}`} {...props} />;
}

/** Number box that opens the number keypad on phones, with the unit written next to it. */
export function NumberInput({ unit, className = "", ...props }) {
  const input = (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step="any"
      className={`${inputClass} text-right ${unit ? "" : className}`}
      {...props}
    />
  );
  if (!unit) return input;
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      {input}
      <span className="min-w-14 text-lg font-bold text-slate-800">{unit}</span>
    </span>
  );
}

export function Select({ children, className = "", ...props }) {
  return (
    <select className={`${inputClass} ${className}`} {...props}>
      {children}
    </select>
  );
}

/** A big tick box with its words next to it. */
export function Checkbox({ label, ...props }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 text-lg font-semibold">
      <input type="checkbox" className="h-7 w-7 accent-sky-700" {...props} />
      {label}
    </label>
  );
}
