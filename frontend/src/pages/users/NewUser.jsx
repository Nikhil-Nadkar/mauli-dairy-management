import { Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUser } from "../../api/endpoints.js";
import Button from "../../components/ui/Button.jsx";
import { Notice } from "../../components/ui/Feedback.jsx";
import { Field, TextInput } from "../../components/ui/Form.jsx";
import { Card, PageHeader } from "../../components/ui/Layout.jsx";
import Segmented from "../../components/ui/Segmented.jsx";
import { useBranchScope } from "../../context/BranchContext.jsx";
import { useAction } from "../../hooks/useAction.js";
import { useT } from "../../i18n/LanguageContext.jsx";

const EMPTY = { full_name: "", email: "", password: "", role: "staff", branch_id: null };

/** Create a login for a new staff member (or another owner). */
export default function NewUser() {
  const { t } = useT();
  const navigate = useNavigate();
  const { branches } = useBranchScope("view");
  const { busy, notice, run, fail } = useAction();
  const [form, setForm] = useState(EMPTY);
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  async function save(e) {
    e.preventDefault();
    if (form.password.length < 8) return fail(t("user.errPasswordShort"));
    if (form.role === "staff" && !form.branch_id) return fail(t("user.chooseBranch"));
    const body = { ...form, branch_id: form.role === "staff" ? form.branch_id : null };
    if (await run(() => createUser(body))) {
      navigate("/users", { state: { notice: { ok: true, text: t("user.created") } } });
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("user.newTitle")} backTo="/users" />
      <Notice notice={notice} />
      <Card as="form" onSubmit={save} className="space-y-6">
        <Field label={t("user.fullName")}>
          <TextInput required value={form.full_name} onChange={(e) => set("full_name")(e.target.value)} />
        </Field>
        <Field label={t("user.email")}>
          <TextInput required type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} />
        </Field>
        <Field label={t("user.password")}>
          <TextInput
            required
            autoComplete="off"
            value={form.password}
            onChange={(e) => set("password")(e.target.value)}
          />
        </Field>

        <div className="space-y-2">
          <p className="text-lg font-bold">{t("user.type")}</p>
          <Segmented
            label={t("user.type")}
            columns="grid-cols-1 sm:grid-cols-2"
            options={[
              { value: "staff", label: `${t("user.staff")} – ${t("user.staffHint")}` },
              { value: "admin", label: `${t("user.owner")} – ${t("user.ownerHint")}` },
            ]}
            value={form.role}
            onChange={set("role")}
          />
        </div>

        {form.role === "staff" && (
          <div className="space-y-2">
            <p className="text-lg font-bold">{t("user.branch")}</p>
            <Segmented
              label={t("user.branch")}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
              value={form.branch_id}
              onChange={set("branch_id")}
            />
          </div>
        )}

        <Button type="submit" variant="success" size="lg" icon={Check} full busy={busy} busyText={t("common.saving")}>
          {t("user.create")}
        </Button>
      </Card>
    </div>
  );
}
