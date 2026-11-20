import { X } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useT } from "../../i18n/LanguageContext.jsx";
import Button from "./Button.jsx";

/**
 * A panel over the page: slides up from the bottom on phones, a centred box on bigger screens.
 * Closes with its Close button, the Escape key, or a tap on the dark background.
 */
export default function Sheet({ title, onClose, hideClose = false, children }) {
  const { t } = useT();
  const titleId = useId();
  const panel = useRef(null);
  const close = useEffectEvent(() => onClose?.());

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind should not scroll
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl focus:outline-none md:max-w-xl md:rounded-3xl"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-2xl font-extrabold leading-tight">
            {title}
          </h2>
          {!hideClose && (
            <Button variant="secondary" icon={X} onClick={onClose} className="shrink-0 px-3">
              {t("common.close")}
            </Button>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
