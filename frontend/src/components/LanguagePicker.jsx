import { useT } from "../i18n/LanguageContext.jsx";
import Segmented from "./ui/Segmented.jsx";

/** English / मराठी. Each name is written in its own language so everyone can find theirs. */
export default function LanguagePicker() {
  const { t, lang, setLang } = useT();
  return (
    <Segmented
      label={t("language.label")}
      columns="grid-cols-2"
      options={[
        { value: "en", label: "English" },
        { value: "mr", label: "मराठी" },
      ]}
      value={lang}
      onChange={setLang}
    />
  );
}
