import { Pencil, Plus } from "lucide-react";
import { useLocation } from "react-router-dom";
import { getProducts } from "../../api/endpoints.js";
import Badge from "../../components/ui/Badge.jsx";
import { ButtonLink } from "../../components/ui/Button.jsx";
import { ErrorNotice, Loading, Notice } from "../../components/ui/Feedback.jsx";
import { Card, PageHeader } from "../../components/ui/Layout.jsx";
import { useBranchScope } from "../../context/BranchContext.jsx";
import { useLoad } from "../../hooks/useLoad.js";
import { useT } from "../../i18n/LanguageContext.jsx";

/** List of products with their prices. Changes happen on each product's own page. */
export default function ProductsPage() {
  const { t } = useT();
  const { state } = useLocation();
  const { branches } = useBranchScope("view");
  const { data: products, error } = useLoad(getProducts);

  return (
    <div className="space-y-5">
      <PageHeader title={t("product.title")} backTo="/more">
        <ButtonLink to="/products/new" icon={Plus} size="lg">
          {t("product.add")}
        </ButtonLink>
      </PageHeader>
      <Notice notice={state?.notice} />
      <ErrorNotice error={error} />

      {!products ? (
        !error && <Loading />
      ) : (
        <ul className="space-y-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} branches={branches} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductCard({ product, branches }) {
  const { t, fmt } = useT();
  return (
    <Card as="li" className={`space-y-3 ${product.is_active ? "" : "bg-slate-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-extrabold">{product.name}</h2>
        <Badge tone={product.is_active ? "good" : "bad"}>
          {product.is_active ? t("product.onSale") : t("product.hidden")}
        </Badge>
      </div>
      <p className="text-lg text-slate-800">
        {product.base_unit === "litre" ? t("product.soldByLitre") : t("product.soldByKg")}
      </p>
      <ul className="space-y-1 text-lg">
        {branches.map((b) => {
          const price = product.prices.find((x) => x.branch_id === b.id);
          return (
            <li key={b.id}>
              <span className="font-bold">{b.name}: </span>
              {price ? (
                t("product.priceLine", {
                  sell: fmt.pricePerUnit(price.selling_price, product.base_unit),
                  cost: fmt.pricePerUnit(price.cost_price, product.base_unit),
                })
              ) : (
                <span className="font-bold text-red-800">{t("product.priceNotSet")}</span>
              )}
            </li>
          );
        })}
      </ul>
      <ButtonLink to={`/products/${product.id}`} variant="secondary" icon={Pencil}>
        {t("product.edit")}
      </ButtonLink>
    </Card>
  );
}
