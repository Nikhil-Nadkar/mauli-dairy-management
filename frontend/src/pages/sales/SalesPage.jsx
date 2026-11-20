import { ReceiptText } from "lucide-react";
import { useCallback, useState } from "react";
import { createSale, getCatalog, getStock, undoSale } from "../../api/endpoints.js";
import BranchPicker from "../../components/BranchPicker.jsx";
import Button from "../../components/ui/Button.jsx";
import { EmptyState, ErrorNotice, Loading, Notice } from "../../components/ui/Feedback.jsx";
import { PageHeader, Section } from "../../components/ui/Layout.jsx";
import { useBranchScope } from "../../context/BranchContext.jsx";
import { useAction } from "../../hooks/useAction.js";
import { useConfirm } from "../../hooks/useConfirm.jsx";
import { useLoad } from "../../hooks/useLoad.js";
import { useOnChange } from "../../hooks/useOnChange.js";
import { useT } from "../../i18n/LanguageContext.jsx";
import {
  addToCart,
  cartToItems,
  cartTotalPaise,
  formatPaise,
  milliInCart,
  removeFromCart,
  toMilli,
} from "../../utils/cart.js";
import BillSheet from "./BillSheet.jsx";
import ProductGrid from "./ProductGrid.jsx";
import QuantitySheet from "./QuantitySheet.jsx";
import SaleSavedPanel from "./SaleSavedPanel.jsx";

/**
 * Selling, in three steps:
 *   1. tap a product   2. tap how much (sheet)   3. "Check bill" -> read it -> "Save sale"
 * After saving, a green panel offers "Undo this sale" for a few minutes.
 */
export default function SalesPage() {
  const { t, fmt } = useT();
  const scope = useBranchScope("work");
  const { busy, notice, setNotice, run } = useAction();
  const { confirm, confirmDialog } = useConfirm();

  const loader = useCallback(async () => {
    const [catalog, stockRows] = await Promise.all([getCatalog(scope.params), getStock(scope.params)]);
    // stock as { [productId]: thousandths of a litre/kg }, so the maths stays exact
    const stock = Object.fromEntries(stockRows.map((r) => [r.product_id, toMilli(r.available)]));
    return { catalog, stock };
  }, [scope.params]);
  const { data, error, loading, reload } = useLoad(loader, { enabled: scope.ready });
  const products = data?.catalog ?? [];
  const stock = data?.stock ?? {};

  const [cart, setCart] = useState([]);
  const [chosenId, setChosenId] = useState(null);
  const [billOpen, setBillOpen] = useState(false);
  const [lastSale, setLastSale] = useState(null); // { id, total } of the sale that can still be undone

  // Switching branch is like walking to another counter: start with an empty bill.
  useOnChange(scope.branchId, () => {
    setCart([]);
    setLastSale(null);
    setNotice(null);
  });

  const chosen = products.find((p) => p.id === chosenId) ?? null;
  const totalPaise = cartTotalPaise(cart);
  const remainingMilli = (productId) => (stock[productId] ?? 0) - milliInCart(cart, productId);

  function addToBill(milli) {
    setCart((c) => addToCart(c, chosen, milli));
    setChosenId(null);
    setNotice(null);
  }

  function removeFromBill(productId) {
    const next = removeFromCart(cart, productId);
    setCart(next);
    if (next.length === 0) setBillOpen(false);
  }

  async function saveSale() {
    let receipt;
    const ok = await run(async () => {
      receipt = await createSale({ ...scope.body, items: cartToItems(cart) });
    });
    setBillOpen(false);
    if (ok) {
      setCart([]);
      setLastSale({ id: receipt.id, total: receipt.total_amount });
    } else {
      setLastSale(null); // make room for the red message; the bill is kept
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    reload(); // stock has changed - or, after a refusal, show the real numbers
  }

  async function undoLastSale() {
    const yes = await confirm({
      title: t("sale.undoTitle", { total: fmt.rupees(lastSale.total) }),
      message: t("sale.undoBody"),
      yes: t("sale.undoYes"),
      tone: "danger",
    });
    if (!yes) return;
    await run(() => undoSale(lastSale.id), t("sale.undone"));
    setLastSale(null);
    reload();
  }

  const itemsText = cart.length === 1 ? t("sale.itemsOne") : t("sale.itemsMany", { count: cart.length });

  return (
    <div className="space-y-5">
      <PageHeader title={t("sale.title")}>
        <BranchPicker scope={scope} />
      </PageHeader>

      <ErrorNotice error={scope.error || error} />
      {lastSale ? (
        <SaleSavedPanel
          key={lastSale.id}
          sale={lastSale}
          busy={busy}
          onUndo={undoLastSale}
          onDone={() => setLastSale(null)}
        />
      ) : (
        <Notice notice={notice} />
      )}

      {!scope.ready || (loading && !data) ? (
        <Loading />
      ) : (
        <Section title={t("sale.chooseProduct")}>
          {products.length === 0 ? (
            <EmptyState>{t("sale.noProducts")}</EmptyState>
          ) : (
            <ProductGrid products={products} stock={stock} cart={cart} chosenId={chosenId} onChoose={setChosenId} />
          )}
        </Section>
      )}

      {/* Shown once something is in the bill; always in reach of the thumb, just above the bottom menu */}
      {cart.length > 0 && (
        <div className="sticky bottom-[calc(var(--nav-height)+0.75rem)] z-20 md:bottom-4">
          <Button
            variant="success"
            size="xl"
            icon={ReceiptText}
            full
            onClick={() => setBillOpen(true)}
            className="shadow-lg"
          >
            {t("sale.checkBill")} · {itemsText} · <span data-testid="cart-total">{formatPaise(totalPaise)}</span>
          </Button>
        </div>
      )}

      {chosen && (
        <QuantitySheet
          key={chosen.id}
          product={chosen}
          remainingMilli={remainingMilli(chosen.id)}
          onAdd={addToBill}
          onClose={() => setChosenId(null)}
        />
      )}
      {billOpen && (
        <BillSheet
          cart={cart}
          stock={stock}
          totalPaise={totalPaise}
          busy={busy}
          onRemove={removeFromBill}
          onSave={saveSale}
          onClose={() => setBillOpen(false)}
        />
      )}
      {confirmDialog}
    </div>
  );
}
