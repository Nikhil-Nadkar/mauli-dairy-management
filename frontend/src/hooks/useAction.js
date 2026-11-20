import { useCallback, useState } from "react";
import { errorMessage } from "../api/client.js";
import { useT } from "../i18n/LanguageContext.jsx";

/**
 * For buttons that save something. Handles the "Saving…" state and the green/red message.
 *
 *   const { busy, notice, setNotice, run } = useAction(initialNotice);
 *   const ok = await run(() => savePrices(id, prices), t("product.pricesSaved"));
 *
 * `run` returns true when the action worked. A second click while busy is ignored.
 */
export function useAction(initialNotice = null) {
  const { tError } = useT();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(initialNotice);

  const run = useCallback(
    async (action, successText) => {
      setBusy(true);
      setNotice(null);
      try {
        await action();
        if (successText) setNotice({ ok: true, text: successText });
        return true;
      } catch (err) {
        setNotice({ ok: false, text: tError(errorMessage(err)) });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [tError]
  );

  /** Shows a red message without calling the server (for checks done on the phone). */
  const fail = useCallback((text) => setNotice({ ok: false, text }), []);

  return { busy, notice, setNotice, run, fail };
}
