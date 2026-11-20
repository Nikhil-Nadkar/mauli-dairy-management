import { Milk } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useT } from "../i18n/LanguageContext.jsx";
import { NAV, isCurrent } from "./navigation.js";

/** Frame around every logged-in page: bottom menu on phones, sidebar on bigger screens. */
export default function AppShell() {
  const { user, isAdmin } = useAuth();
  const { t } = useT();
  const { pathname } = useLocation();
  const nav = isAdmin ? NAV.owner : NAV.staff;

  return (
    <div className="min-h-screen md:flex">
      {/* Bigger screens: sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col gap-2 border-r border-slate-200 bg-white p-4 md:flex">
        <p className="mb-4 flex items-center gap-2 text-3xl font-extrabold text-sky-800">
          <Milk aria-hidden="true" className="h-9 w-9" />
          {t("app.name")}
        </p>
        <nav aria-label={t("nav.menu")} className="flex flex-col gap-2">
          {nav.sidebar.map((item) => {
            const current = isCurrent(item, pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-14 items-center gap-3 rounded-2xl px-4 text-lg font-bold ${
                  current ? "bg-sky-700 text-white" : "text-slate-800 hover:bg-sky-50"
                }`}
              >
                <item.icon aria-hidden="true" className="h-7 w-7" />
                {t(item.label)}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-slate-200 pt-4">
          <p className="text-lg font-bold">{user.full_name}</p>
          <p className="text-slate-700">{user.branch ? user.branch.name : t("branch.both")}</p>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-[calc(var(--nav-height)+1.5rem)] md:p-8">
        <Outlet />
      </main>

      {/* Phones: bottom menu, always within thumb reach */}
      <nav
        aria-label={t("nav.menu")}
        className="fixed inset-x-0 bottom-0 z-30 flex h-[var(--nav-height)] border-t-2 border-slate-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.08)] md:hidden"
      >
        {nav.tabs.map((item) => {
          const current = isCurrent(item, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={current ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 font-bold ${
                nav.tabs.length > 4 ? "text-[0.8rem]" : "text-base"
              } ${current ? "bg-sky-50 text-sky-800" : "text-slate-700"}`}
            >
              <span className={`rounded-full px-3 py-1 ${current ? "bg-sky-700 text-white" : ""}`}>
                <item.icon aria-hidden="true" className="h-7 w-7" strokeWidth={current ? 2.75 : 2} />
              </span>
              {t(item.label)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
