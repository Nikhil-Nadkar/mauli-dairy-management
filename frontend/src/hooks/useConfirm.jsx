import { useCallback, useState } from "react";
import { useT } from "../i18n/LanguageContext.jsx";
import Button from "../components/ui/Button.jsx";
import Sheet from "../components/ui/Sheet.jsx";

/**
 * A big "Are you sure?" question before anything that is hard to take back.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (await confirm({ title: "Hide Milk?", message: "...", yes: "Yes, hide it", tone: "danger" })) { ... }
 *   ...
 *   return <>{page}{confirmDialog}</>;
 */
export function useConfirm() {
  const { t } = useT();
  const [question, setQuestion] = useState(null);

  const confirm = useCallback((options) => new Promise((resolve) => setQuestion({ ...options, resolve })), []);

  const answer = (yes) => {
    question.resolve(yes);
    setQuestion(null);
  };

  const confirmDialog = question && (
    <Sheet title={question.title} onClose={() => answer(false)} hideClose>
      {question.message && <div className="text-xl text-slate-800">{question.message}</div>}
      <div className="mt-6 grid gap-3">
        <Button variant={question.tone ?? "primary"} size="lg" onClick={() => answer(true)}>
          {question.yes}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => answer(false)}>
          {t("common.noGoBack")}
        </Button>
      </div>
    </Sheet>
  );

  return { confirm, confirmDialog };
}
