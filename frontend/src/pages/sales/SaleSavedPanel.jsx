import { Check, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { UNDO_MINUTES } from "../../api/endpoints.js";
import Button from "../../components/ui/Button.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";
import { useT } from "../../i18n/LanguageContext.jsx";

const SAFETY_MS = 5_000; // hide the Undo button a little before the server stops accepting it

/** Big green "Sale saved" message with an Undo button for the first few minutes. */
export default function SaleSavedPanel({ sale, busy, onUndo, onDone }) {
  const { t, fmt } = useT();
  const [canUndo, setCanUndo] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setCanUndo(false), UNDO_MINUTES * 60_000 - SAFETY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Notice notice={{ ok: true, text: t("sale.saved", { total: fmt.rupees(sale.total) }) }}>
      {canUndo && <p className="text-lg font-semibold">{t("sale.undoHint", { minutes: UNDO_MINUTES })}</p>}
      <div className="flex flex-wrap gap-3">
        <Button variant="success" icon={Check} onClick={onDone}>
          {t("sale.nextCustomer")}
        </Button>
        {canUndo && (
          <Button variant="dangerSoft" icon={Undo2} busy={busy} busyText={t("common.saving")} onClick={onUndo}>
            {t("sale.undo")}
          </Button>
        )}
      </div>
    </Notice>
  );
}
