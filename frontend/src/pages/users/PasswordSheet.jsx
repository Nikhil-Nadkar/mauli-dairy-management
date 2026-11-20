import { Check } from "lucide-react";
import { useState } from "react";
import Button from "../../components/ui/Button.jsx";
import { Field, TextInput } from "../../components/ui/Form.jsx";
import Sheet from "../../components/ui/Sheet.jsx";
import { useT } from "../../i18n/LanguageContext.jsx";

const MIN_LENGTH = 8;

/** Type a new password for someone. It is shown in plain text so it can be read out to them. */
export default function PasswordSheet({ user, busy, onSave, onClose }) {
  const { t } = useT();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function save(e) {
    e.preventDefault();
    if (password.length < MIN_LENGTH) return setError(t("user.errPasswordShort"));
    onSave(password);
  }

  return (
    <Sheet title={t("user.passwordFor", { name: user.full_name })} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label={t("user.newPassword")}>
          <TextInput
            autoComplete="off"
            value={password}
            onChange={(e) => (setPassword(e.target.value), setError(""))}
          />
        </Field>
        {error && (
          <p role="alert" className="text-lg font-bold text-red-800">
            {error}
          </p>
        )}
        <Button type="submit" variant="success" size="lg" icon={Check} full busy={busy} busyText={t("common.saving")}>
          {t("user.savePassword")}
        </Button>
      </form>
    </Sheet>
  );
}
