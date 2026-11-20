import { Eye, EyeOff } from "lucide-react";
import { useCallback } from "react";
import { useLocation, useParams } from "react-router-dom";
import { getProducts, savePrices, updateProduct } from "../../api/endpoints.js";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import { EmptyState, ErrorNotice, Loading, Notice } from "../../components/ui/Feedback.jsx";
import { Card, PageHeader, Section } from "../../components/ui/Layout.jsx";
import { useBranchScope } from "../../context/BranchContext.jsx";
import { useAction } from "../../hooks/useAction.js";
import { useConfirm } from "../../hooks/useConfirm.jsx";
import { useLoad } from "../../hooks/useLoad.js";
import { useT } from "../../i18n/LanguageContext.jsx";
import PriceEditor from "./PriceEditor.jsx";
import ProductForm from "./ProductForm.jsx";

/** One product: its prices, its details, and hiding it from sales. */
export default function EditProduct() {
  const { t } = useT();
  const id = Number(useParams().id);
  const { state } = useLocation();
  const { branches } = useBranchScope("view");
  const { busy, notice, run, fail } = useAction(state?.notice);
  const { confirm, confirmDialog } = useConfirm();

  const loader = useCallback(async () => (await getProducts()).find((p) => p.id === id) ?? null, [id]);
  const { data: product, error, loading, reload } = useLoad(loader);

  async function save(action, successText) {
    if (await run(action, successText)) await reload();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleOnSale() {
    if (product.is_active) {
      const yes = await confirm({
        title: t("product.hideTitle", { name: product.name }),
        message: t("product.hideBody"),
        yes: t("product.hideYes"),
        tone: "danger",
      });
      if (!yes) return;
    }
    const text = product.is_active ? "product.hiddenDone" : "product.shownDone";
    await save(() => updateProduct(id, { is_active: !product.is_active }), t(text, { name: product.name }));
  }

  if (!product) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("product.title")} backTo="/products" />
        <ErrorNotice error={error} />
        {loading ? <Loading /> : !error && <EmptyState>{t("product.notFound")}</EmptyState>}
      </div>
    );
  }

  // Keys change after every save, so the boxes show exactly what was saved.
  const savedVersion = JSON.stringify(product);

  return (
    <div className="space-y-6">
      <PageHeader title={product.name} backTo="/products">
        <Badge tone={product.is_active ? "good" : "bad"}>
          {product.is_active ? t("product.onSale") : t("product.hidden")}
        </Badge>
      </PageHeader>
      <Notice notice={notice} />

      <Section title={t("product.prices")}>
        <Card>
          {branches.length > 0 && (
            <PriceEditor
              key={`prices-${savedVersion}`}
              product={product}
              branches={branches}
              busy={busy}
              onError={fail}
              onSave={(prices) => save(() => savePrices(id, prices), t("product.pricesSaved", { name: product.name }))}
            />
          )}
        </Card>
      </Section>

      <Section title={t("product.details")}>
        <Card>
          <ProductForm
            key={`details-${savedVersion}`}
            initial={{ ...product, low_stock_threshold: String(Number(product.low_stock_threshold)) }}
            submitText={t("product.save")}
            busy={busy}
            onSubmit={(form) =>
              save(
                () =>
                  updateProduct(id, {
                    name: form.name,
                    base_unit: form.base_unit,
                    quick_quantities: form.quick_quantities,
                    low_stock_threshold: form.low_stock_threshold,
                  }),
                t("product.saved")
              )
            }
          />
        </Card>
      </Section>

      <Button
        variant={product.is_active ? "dangerSoft" : "success"}
        size="lg"
        icon={product.is_active ? EyeOff : Eye}
        full
        busy={busy}
        onClick={toggleOnSale}
      >
        {product.is_active ? t("product.hide") : t("product.show")}
      </Button>
      {confirmDialog}
    </div>
  );
}
