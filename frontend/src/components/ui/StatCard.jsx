import { useT } from "../../i18n/LanguageContext.jsx";

const TONES = { default: "text-slate-900", good: "text-green-800", warn: "text-amber-800", bad: "text-red-800" };

/** One big number with its name above it. */
export default function StatCard({ label, value, hint, tone = "default" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-lg font-semibold text-slate-700">{label}</p>
      <p className={`mt-1 text-4xl font-extrabold ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-base text-slate-700">{hint}</p>}
    </div>
  );
}

/** Explains that "gross profit" does not include rent, salaries, etc. */
export function GrossProfitNote() {
  const { t } = useT();
  return (
    <p className="text-base text-slate-700">
      {t("profitNote.before")}
      <strong>{t("profitNote.not")}</strong>
      {t("profitNote.after")}
    </p>
  );
}
