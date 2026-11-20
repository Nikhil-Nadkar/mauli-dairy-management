import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useT } from "../../i18n/LanguageContext.jsx";

/** White box around a part of a page. */
export function Card({ as: Tag = "div", className = "", children, ...rest }) {
  return (
    <Tag className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** Page title, an optional "Back" link above it, and anything under it (e.g. the branch buttons). */
export function PageHeader({ title, backTo, children }) {
  const { t } = useT();
  return (
    <header className="space-y-3">
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl pr-3 text-lg font-bold text-sky-800 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
          {t("common.back")}
        </Link>
      )}
      <h1 className="text-3xl font-extrabold leading-tight">{title}</h1>
      {children}
    </header>
  );
}

/** A titled part of a page. `label` names it for screen readers. */
export function Section({ title, label, children, className = "" }) {
  return (
    <section aria-label={label ?? title} className={`space-y-3 ${className}`}>
      {title && <h2 className="text-2xl font-bold">{title}</h2>}
      {children}
    </section>
  );
}

/** Big menu tile: icon, title and a short line of help. Used for "one job per screen" menus. */
export function Tile({ to, icon: Icon, title, hint }) {
  return (
    <Link
      to={to}
      className="flex min-h-24 items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm hover:border-sky-600 active:bg-sky-50"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
        <Icon aria-hidden="true" className="h-8 w-8" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-extrabold">{title}</span>
        {hint && <span className="block text-base text-slate-700">{hint}</span>}
      </span>
      <ChevronRight aria-hidden="true" className="h-7 w-7 shrink-0 text-slate-500" />
    </Link>
  );
}

/** Label/value rows, e.g. "Sold: 4 L". */
export function Facts({ rows }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-lg">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-slate-700">{label}</dt>
          <dd className="text-right font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
