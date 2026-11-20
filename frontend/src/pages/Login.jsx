import { LogIn, Milk } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import LanguagePicker from "../components/LanguagePicker.jsx";
import Button from "../components/ui/Button.jsx";
import { Notice } from "../components/ui/Feedback.jsx";
import { Checkbox, Field, TextInput } from "../components/ui/Form.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAction } from "../hooks/useAction.js";
import { useT } from "../i18n/LanguageContext.jsx";

export default function Login() {
  const { t } = useT();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { busy, notice, run } = useAction();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (await run(() => login(email.trim(), password))) {
      navigate(location.state?.from?.pathname || "/", { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <LanguagePicker />
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl bg-white p-6 shadow-md sm:p-8">
          <h1 className="flex flex-col items-center gap-2 text-center text-3xl font-extrabold text-sky-800">
            <Milk aria-hidden="true" className="h-10 w-10" />
            {t("login.title")}
          </h1>

          <Field label={t("login.email")}>
            <TextInput
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label={t("login.password")}>
            <TextInput
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Checkbox
            label={t("login.showPassword")}
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
          />

          <Notice notice={notice} />

          <Button type="submit" size="xl" icon={LogIn} full busy={busy} busyText={t("login.wait")}>
            {t("login.submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
