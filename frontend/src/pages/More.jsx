import { NAV } from "../app/navigation.js";
import { PageHeader, Tile } from "../components/ui/Layout.jsx";
import { useT } from "../i18n/LanguageContext.jsx";

/** Owner's "More" tab on phones: the pages that do not fit in the bottom menu. */
export default function More() {
  const { t } = useT();
  return (
    <div className="space-y-5">
      <PageHeader title={t("more.title")} />
      <div className="grid gap-3">
        {NAV.owner.more.map((item) => (
          <Tile key={item.to} to={item.to} icon={item.icon} title={t(item.label)} />
        ))}
      </div>
    </div>
  );
}
