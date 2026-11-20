import { Check } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStock, receiveStock } from "../../api/endpoints.js";
import BranchPicker from "../../components/BranchPicker.jsx";
import { StatusBadge } from "../../components/StockStatus.jsx";
import Button from "../../components/ui/Button.jsx";
import { ErrorNotice, Loading, Notice } from "../../components/ui/Feedback.jsx";
import { NumberInput } from "../../components/ui/Form.jsx";
import { Card, PageHeader } from "../../components/ui/Layout.jsx";
import { useBranchScope } from "../../context/BranchContext.jsx";
import { useAction } from "../../hooks/useAction.js";
import { useConfirm } from "../../hooks/useConfirm.jsx";
import { useLoad } from "../../hooks/useLoad.js";
import { useOnChange } from "../../hooks/useOnChange.js";
import { useT } from "../../i18n/LanguageContext.jsx";

/** "Stock arrived": type how much of each product came in, check it, save once. */
export default function ReceiveStock() {
  const { t, fmt } = useT();
  const navigate = useNavigate();
  const scope = useBranchScope("work");
  const { busy, notice, run, fail } = useAction();
  const { confirm, confirmDialog } = useConfirm();

  const loader = useCallback(() => getStock(scope.params), [scope.params]);
  const { data: rows, error } = useLoad(loader, { enabled: scope.ready });
  const active = (rows ?? []).filter((r) => r.is_active);

  const [incoming, setIncoming] = useState({}); // { [productId]: "15" }
  useOnChange(scope.branchId, () => setIncoming({}));

  async function save(e) {
    e.preventDefault();
    const items = active
      .filter((r) => Number(incoming[r.product_id]) > 0)
      .map((r) => ({ row: r, quantity: incoming[r.product_id] }));
    if (items.length === 0) return fail(t("stock.errNoQty"));

    const yes = await confirm({
      title: t("stock.arrivedTitle"),
      message: (
        <ul className="space-y-1">
          {items.map(({ row, quantity }) => (
            <li key={row.product_id}>
              <strong>{row.name}</strong>: + {fmt.qty(quantity, row.base_unit)}
            </li>
          ))}
        </ul>
      ),
      yes: t("stock.arrivedYes"),
      tone: "success",
    });
    if (!yes) return;

    const body = { ...scope.body, items: items.map(({ row, quantity }) => ({ product_id: row.product_id, quantity })) };
    if (await run(() => receiveStock(body))) {
      const text =
        items.length === 1 ? t("stock.arrivedSavedOne") : t("stock.arrivedSavedMany", { count: items.length });
      navigate("/stock", { state: { notice: { ok: true, text } } });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("stock.arrived")} backTo="/stock">
        <BranchPicker scope={scope} />
      </PageHeader>
      <ErrorNotice error={scope.error || error} />
      <Notice notice={notice} />

      {!rows ? (
        !error && <Loading />
      ) : (
        <Card as="form" onSubmit={save} className="space-y-4">
          <p className="text-xl text-slate-800">{t("stock.arrivedIntro")}</p>
          <ul className="divide-y-2 divide-slate-100">
            {active.map((r) => (
              <li key={r.product_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-2xl font-extrabold">{r.name}</p>
                  <p className="flex flex-wrap items-center gap-2 text-lg text-slate-800">
                    {t("stock.nowQty", { qty: fmt.qty(r.available, r.base_unit) })} <StatusBadge status={r.status} />
                  </p>
                </div>
                <NumberInput
                  unit={fmt.unitLong(r.base_unit)}
                  placeholder="0"
                  aria-label={t("stock.incomingName", { name: r.name, unit: fmt.unitLong(r.base_unit) })}
                  value={incoming[r.product_id] ?? ""}
                  onChange={(e) => setIncoming({ ...incoming, [r.product_id]: e.target.value })}
                  className="w-56"
                />
              </li>
            ))}
          </ul>
          <Button type="submit" variant="success" size="lg" icon={Check} full busy={busy} busyText={t("common.saving")}>
            {t("stock.saveArrived")}
          </Button>
        </Card>
      )}
      {confirmDialog}
    </div>
  );
}
