import { KeyRound, Plus, Power, PowerOff } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { getUsers, resetPassword, updateUser } from "../../api/endpoints.js";
import Badge from "../../components/ui/Badge.jsx";
import Button, { ButtonLink } from "../../components/ui/Button.jsx";
import { ErrorNotice, Loading, Notice } from "../../components/ui/Feedback.jsx";
import { Field, Select } from "../../components/ui/Form.jsx";
import { Card, PageHeader } from "../../components/ui/Layout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useBranchScope } from "../../context/BranchContext.jsx";
import { useAction } from "../../hooks/useAction.js";
import { useConfirm } from "../../hooks/useConfirm.jsx";
import { useLoad } from "../../hooks/useLoad.js";
import { useT } from "../../i18n/LanguageContext.jsx";
import PasswordSheet from "./PasswordSheet.jsx";

/** Everyone who can log in. Each change asks first, then shows a green or red message at the top. */
export default function UsersPage() {
  const { t } = useT();
  const { state } = useLocation();
  const { user: me } = useAuth();
  const { branches } = useBranchScope("view");
  const { data: users, error, reload } = useLoad(getUsers);
  const { busy, notice, run } = useAction(state?.notice);
  const { confirm, confirmDialog } = useConfirm();
  const [passwordFor, setPasswordFor] = useState(null); // the user whose password is being changed

  async function save(action, successText) {
    const ok = await run(action, successText);
    if (ok) await reload();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return ok;
  }

  async function moveToBranch(u, branchId) {
    const branch = branches.find((b) => b.id === branchId);
    const yes = await confirm({
      title: t("user.moveTitle", { name: u.full_name, branch: branch.name }),
      yes: t("user.moveYes"),
    });
    if (yes) await save(() => updateUser(u.id, { branch_id: branchId }), t("user.moved"));
  }

  async function toggleActive(u) {
    if (u.is_active) {
      const yes = await confirm({
        title: t("user.turnOffTitle", { name: u.full_name }),
        message: t("user.turnOffBody", { name: u.full_name }),
        yes: t("user.turnOffYes"),
        tone: "danger",
      });
      if (!yes) return;
    }
    await save(
      () => updateUser(u.id, { is_active: !u.is_active }),
      u.is_active ? t("user.turnedOff") : t("user.turnedOn")
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("user.title")} backTo="/more">
        <ButtonLink to="/users/new" icon={Plus} size="lg">
          {t("user.add")}
        </ButtonLink>
      </PageHeader>
      <Notice notice={notice} />
      <ErrorNotice error={error} />

      {!users ? (
        !error && <Loading />
      ) : (
        <ul className="space-y-3">
          {users.map((u) => {
            const isMe = u.id === me.id;
            return (
              <Card as="li" key={u.id} className={`space-y-4 ${u.is_active ? "" : "bg-slate-50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-2xl font-extrabold">
                      {u.full_name} {isMe && <span className="text-lg font-normal">{t("common.you")}</span>}
                    </p>
                    <p className="break-all text-lg text-slate-800">{u.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="info">{u.role === "admin" ? t("user.owner") : u.branch?.name}</Badge>
                    <Badge tone={u.is_active ? "good" : "bad"}>{u.is_active ? t("user.active") : t("user.off")}</Badge>
                  </div>
                </div>

                {u.role === "staff" && (
                  <Field label={t("user.branchOf", { name: u.full_name })}>
                    <Select value={u.branch_id ?? ""} onChange={(e) => moveToBranch(u, Number(e.target.value))}>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" icon={KeyRound} onClick={() => setPasswordFor(u)}>
                    {t("user.changePassword")}
                  </Button>
                  {!isMe && (
                    <Button
                      variant={u.is_active ? "dangerSoft" : "success"}
                      icon={u.is_active ? PowerOff : Power}
                      busy={busy}
                      onClick={() => toggleActive(u)}
                    >
                      {u.is_active ? t("user.turnOff") : t("user.turnOn")}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </ul>
      )}

      {passwordFor && (
        <PasswordSheet
          user={passwordFor}
          busy={busy}
          onClose={() => setPasswordFor(null)}
          onSave={async (password) => {
            await save(() => resetPassword(passwordFor.id, password), t("user.passwordChanged"));
            setPasswordFor(null); // close either way, so the green or red message at the top is visible
          }}
        />
      )}
      {confirmDialog}
    </div>
  );
}
