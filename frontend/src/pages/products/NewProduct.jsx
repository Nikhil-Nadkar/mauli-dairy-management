import { useNavigate } from "react-router-dom";
import { createProduct } from "../../api/endpoints.js";
import { Notice } from "../../components/ui/Feedback.jsx";
import { Card, PageHeader } from "../../components/ui/Layout.jsx";
import { useAction } from "../../hooks/useAction.js";
import { useT } from "../../i18n/LanguageContext.jsx";
import ProductForm, { NEW_PRODUCT } from "./ProductForm.jsx";

/** Add a product, then go straight to its page to set the prices. */
export default function NewProduct() {
  const { t } = useT();
  const navigate = useNavigate();
  const { busy, notice, run } = useAction();

  async function save(form) {
    let created;
    const ok = await run(async () => {
      created = await createProduct(form);
    });
    if (ok) navigate(`/products/${created.id}`, { state: { notice: { ok: true, text: t("product.added") } } });
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("product.newTitle")} backTo="/products" />
      <Notice notice={notice} />
      <Card>
        <ProductForm initial={NEW_PRODUCT} isNew submitText={t("product.create")} busy={busy} onSubmit={save} />
      </Card>
    </div>
  );
}
