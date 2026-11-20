import { EmptyState } from "../../components/ui/Feedback.jsx";
import { Card, Facts, Section } from "../../components/ui/Layout.jsx";
import { useT } from "../../i18n/LanguageContext.jsx";

// On a phone, wide tables are hard to read, so each row is shown as its own small card.

export function ProductSales({ products }) {
  const { t, fmt } = useT();
  return (
    <Section title={t("report.products")}>
      {products.length === 0 ? (
        <EmptyState>{t("report.noSales")}</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {products.map((p) => (
            <Card as="li" key={p.product_id} className="space-y-2">
              <h3 className="text-xl font-extrabold">{p.name}</h3>
              <Facts
                rows={[
                  [t("report.sold"), fmt.qty(p.quantity, p.base_unit)],
                  [t("report.sales"), fmt.rupees(p.sales)],
                  [t("report.grossProfit"), fmt.rupees(p.profit)],
                ]}
              />
            </Card>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function BranchSales({ branches }) {
  const { t, fmt } = useT();
  return (
    <Section title={t("report.branches")}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {branches.map((b) => (
          <Card as="li" key={b.branch_id} className="space-y-2">
            <h3 className="text-xl font-extrabold">{b.name}</h3>
            <Facts
              rows={[
                [t("report.sales"), fmt.rupees(b.sales)],
                [t("report.cost"), fmt.rupees(b.cost)],
                [t("report.grossProfit"), fmt.rupees(b.profit)],
              ]}
            />
          </Card>
        ))}
      </ul>
    </Section>
  );
}
