import { LogOut, UserRound } from "lucide-react";
import LanguagePicker from "../components/LanguagePicker.jsx";
import Button from "../components/ui/Button.jsx";
import { Card, PageHeader } from "../components/ui/Layout.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useConfirm } from "../hooks/useConfirm.jsx";
import { useTextSize } from "../hooks/useTextSize.js";
import { useT } from "../i18n/LanguageContext.jsx";

/** Who is logged in, language, text size, and log out. */
export default function Account() {
  const { t } = useT();
  const { user, isAdmin, logout } = useAuth();
  const [textSize, setTextSize] = useTextSize();
  const { confirm, confirmDialog } = useConfirm();

  async function askLogout() {
    const yes = await confirm({
      title: t("account.logoutTitle"),
      message: t("account.logoutBody"),
      yes: t("account.logoutYes"),
      tone: "danger",
    });
    if (yes) logout();
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("account.title")} />

      <Card className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800">
          <UserRound aria-hidden="true" className="h-9 w-9" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-extrabold">{user.full_name}</p>
          <p className="text-lg text-slate-800">{isAdmin ? t("account.owner") : user.branch?.name}</p>
          <p className="break-all text-base text-slate-700">{user.email}</p>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">{t("language.label")}</h2>
        <LanguagePicker />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-xl font-bold">{t("account.textSize")}</h2>
        <Segmented
          label={t("account.textSize")}
          columns="grid-cols-2"
          options={[
            { value: "normal", label: t("account.textNormal") },
            { value: "large", label: t("account.textLarge") },
          ]}
          value={textSize}
          onChange={setTextSize}
        />
        <p className="text-lg text-slate-800">{t("account.sample")}</p>
      </Card>

      <Button variant="dangerSoft" size="lg" icon={LogOut} full onClick={askLogout}>
        {t("account.logout")}
      </Button>
      {confirmDialog}
    </div>
  );
}
