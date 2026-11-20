import { Store } from "lucide-react";
import { useT } from "../i18n/LanguageContext.jsx";
import Segmented from "./ui/Segmented.jsx";

/**
 * The owner sees big branch buttons ("Both branches" too, on Home and Reports).
 * Staff only see the name of their own branch.
 */
export default function BranchPicker({ scope }) {
  const { t } = useT();

  if (!scope.isAdmin) {
    return scope.branchName ? (
      <p className="flex items-center gap-2 text-xl font-bold text-slate-800">
        <Store aria-hidden="true" className="h-6 w-6" />
        {scope.branchName}
      </p>
    ) : null;
  }

  const options = [
    ...(scope.mode === "view" ? [{ value: null, label: t("branch.both") }] : []),
    ...scope.branches.map((b) => ({ value: b.id, label: b.name })),
  ];
  return <Segmented label={t("branch.label")} options={options} value={scope.branchId} onChange={scope.setBranchId} />;
}
