import { Check, Minus, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adjustStock, getStock } from "../../api/endpoints.js";
import BranchPicker from "../../components/BranchPicker.jsx";
import Button from "../../components/ui/Button.jsx";
import { ErrorNotice, Loading, Notice } from "../../components/ui/Feedback.jsx";
import { Field, NumberInput, Select, TextInput } from "../../components/ui/Form.jsx";
import { Card, PageHeader } from "../../components/ui/Layout.jsx";
import Segmented from "../../components/ui/Segmented.jsx";
import { useBranchScope } from "../../context/BranchContext.jsx";
import { useAction } from "../../hooks/useAction.js";
import { useConfirm } from "../../hooks/useConfirm.jsx";
import { useLoad } from "../../hooks/useLoad.js";
import { useOnChange } from "../../hooks/useOnChange.js";
import { useT } from "../../i18n/LanguageContext.jsx";
import { REASONS, reasonToSave, showReason } from "./reasons.js";

const EMPTY = { productId: "", direction: "remove", quantity: "", reason: "Damaged", note: "" };

/** "Correct stock": numbered questions, one per box, then a check before saving. */
export default function CorrectStock() {
  const { t, fmt } = useT();
  const navigate = useNavigate();
  const scope = useBranchScope("work");
  const { busy, notice, run, fail } = useAction();
  const { confirm, confirmDialog } = useConfirm();

  const loader = useCallback(() => getStock(scope.params), [scope.params]);
  const { data: rows, error } = useLoad(loader, { enabled: scope.ready });

  const [form, setForm] = useState(EMPTY);
  useOnChange(scope.branchId, () => setForm(EMPTY));
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const product = (rows ?? []).find((r) => r.product_id === Number(form.productId));

  async function save(e) {
    e.preventDefault();
    if (!product) return fail(t("stock.errChooseProduct"));
    const amount = Number(form.quantity);
    if (!(amount > 0)) return fail(t("stock.errHowMuch"));
    if (form.reason === "Other" && form.note.trim().length < 3) return fail(t("stock.errReason"));
    if (form.direction === "remove" && amount > Number(product.available)) {
      return fail(t("stock.errOnly", { qty: fmt.qty(product.available, product.base_unit), name: product.name }));
    }

    const reason = reasonToSave(form.reason, form.note);
    const titleKey = form.direction === "remove" ? "stock.removeTitle" : "stock.addTitle";
    const yes = await confirm({
      title: t(titleKey, { qty: fmt.qty(form.quantity, product.base_unit), name: product.name }),
      message: t("stock.reasonLine", { reason: showReason(reason, t) }),
      yes: t("stock.correctYes"),
      tone: form.direction === "remove" ? "danger" : "success",
    });
    if (!yes) return;

    const body = {
      ...scope.body,
      product_id: product.product_id,
      quantity_change: form.direction === "remove" ? `-${form.quantity}` : form.quantity,
      reason,
    };
    if (await run(() => adjustStock(body))) {
      navigate("/stock", { state: { notice: { ok: true, text: t("stock.corrected") } } });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("stock.correct")} backTo="/stock">
        <BranchPicker scope={scope} />
      </PageHeader>
      <ErrorNotice error={scope.error || error} />
      <Notice notice={notice} />

      {!rows ? (
        !error && <Loading />
      ) : (
        <Card as="form" onSubmit={save} className="space-y-6">
          <p className="text-xl text-slate-800">{t("stock.correctIntro")}</p>

          <Field label={t("stock.product")}>
            <Select value={form.productId} onChange={(e) => set("productId")(e.target.value)}>
              <option value="">{t("stock.chooseProduct")}</option>
              {rows.map((r) => (
                <option key={r.product_id} value={r.product_id}>
                  {t("stock.productOption", { name: r.name, qty: fmt.qty(r.available, r.base_unit) })}
                </option>
              ))}
            </Select>
          </Field>

          <div className="space-y-2">
            <p className="text-lg font-bold">{t("stock.direction")}</p>
            <Segmented
              label={t("stock.direction")}
              columns="grid-cols-2"
              options={[
                { value: "remove", label: t("stock.remove") },
                { value: "add", label: t("stock.add") },
              ]}
              value={form.direction}
              onChange={set("direction")}
            />
          </div>

          <Field
            label={product ? t("stock.amount", { unit: fmt.unitLong(product.base_unit) }) : t("stock.amountNoUnit")}
          >
            <NumberInput
              unit={product ? fmt.unitLong(product.base_unit) : undefined}
              value={form.quantity}
              onChange={(e) => set("quantity")(e.target.value)}
            />
          </Field>

          <div className="space-y-2">
            <p className="text-lg font-bold">{t("stock.reason")}</p>
            <Segmented
              label={t("stock.reason")}
              columns="grid-cols-2"
              options={REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) }))}
              value={form.reason}
              onChange={set("reason")}
            />
          </div>

          <Field label={form.reason === "Other" ? t("stock.writeReason") : t("stock.note")}>
            <TextInput maxLength={150} value={form.note} onChange={(e) => set("note")(e.target.value)} />
          </Field>

          <Button
            type="submit"
            variant={form.direction === "remove" ? "danger" : "success"}
            size="lg"
            icon={form.direction === "remove" ? Minus : Plus}
            full
            busy={busy}
            busyText={t("common.saving")}
          >
            {t("stock.saveCorrection")}
          </Button>
        </Card>
      )}
      {confirmDialog}
    </div>
  );
}
