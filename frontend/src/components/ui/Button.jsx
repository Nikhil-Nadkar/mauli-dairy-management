import { Link } from "react-router-dom";

// Colours chosen for strong contrast with white text (WCAG AA at these sizes).
const VARIANTS = {
  primary: "bg-sky-700 text-white hover:bg-sky-800 active:bg-sky-900",
  success: "bg-green-700 text-white hover:bg-green-800 active:bg-green-900",
  danger: "bg-red-700 text-white hover:bg-red-800 active:bg-red-900",
  dark: "bg-slate-800 text-white hover:bg-slate-900",
  secondary: "border-2 border-slate-400 bg-white text-slate-900 hover:bg-slate-50 active:bg-slate-100",
  dangerSoft: "border-2 border-red-300 bg-red-50 text-red-800 hover:bg-red-100",
};

const SIZES = {
  md: "min-h-14 px-5 text-lg gap-2",
  lg: "min-h-16 px-6 text-xl gap-3",
  xl: "min-h-20 px-6 text-2xl gap-3",
};

const DISABLED =
  "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-slate-300 disabled:text-slate-600";

export function buttonClass({ variant = "primary", size = "md", full = false, className = "" } = {}) {
  return [
    "inline-flex items-center justify-center rounded-2xl font-bold text-center leading-tight",
    VARIANTS[variant],
    SIZES[size],
    DISABLED,
    full ? "w-full" : "",
    className,
  ].join(" ");
}

/**
 * <Button variant="success" size="lg" icon={Check} busy={busy} busyText="Saving…" full>Save sale</Button>
 * Icons are always shown together with words, never alone.
 */
export default function Button({
  variant,
  size,
  full,
  icon: Icon,
  busy = false,
  busyText,
  className,
  children,
  type = "button",
  disabled,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={buttonClass({ variant, size, full, className })}
      {...rest}
    >
      {Icon && <Icon aria-hidden="true" className="h-[1.3em] w-[1.3em] shrink-0" strokeWidth={2.5} />}
      <span>{busy && busyText ? busyText : children}</span>
    </button>
  );
}

/** A link that looks like a button. */
export function ButtonLink({ to, state, variant, size, full, icon: Icon, className, children }) {
  return (
    <Link to={to} state={state} className={buttonClass({ variant, size, full, className })}>
      {Icon && <Icon aria-hidden="true" className="h-[1.3em] w-[1.3em] shrink-0" strokeWidth={2.5} />}
      <span>{children}</span>
    </Link>
  );
}
