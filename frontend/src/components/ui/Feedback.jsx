import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useT } from "../../i18n/LanguageContext.jsx";

/**
 * The one big message area of a page. notice = { ok: true|false, text }.
 * Green with a tick when something worked, red with a warning sign when it did not.
 */
export function Notice({ notice, children }) {
  if (!notice?.text) return null;
  const Icon = notice.ok ? CheckCircle2 : AlertTriangle;
  return (
    <div
      role="status"
      className={`space-y-3 rounded-2xl border-2 p-4 text-xl font-bold ${
        notice.ok ? "border-green-700 bg-green-50 text-green-900" : "border-red-700 bg-red-50 text-red-900"
      }`}
    >
      <p className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-8 w-8 shrink-0" strokeWidth={2.5} />
        <span className="min-w-0">{notice.text}</span>
      </p>
      {children}
    </div>
  );
}

/** Shows an error text (if any) as a red Notice. */
export const ErrorNotice = ({ error }) => <Notice notice={error ? { ok: false, text: error } : null} />;

export function Loading() {
  const { t } = useT();
  return (
    <p className="flex items-center gap-3 py-6 text-xl font-semibold text-slate-700">
      <Loader2 aria-hidden="true" className="h-7 w-7 animate-spin" />
      {t("common.loading")}
    </p>
  );
}

export function EmptyState({ children }) {
  return (
    <p className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-xl text-slate-700">
      {children}
    </p>
  );
}
