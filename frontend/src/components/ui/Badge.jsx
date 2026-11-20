const TONES = {
  good: "bg-green-100 text-green-900 border-green-300",
  warn: "bg-amber-100 text-amber-900 border-amber-400",
  bad: "bg-red-100 text-red-900 border-red-400",
  info: "bg-sky-100 text-sky-900 border-sky-300",
  plain: "bg-slate-100 text-slate-800 border-slate-300",
};

/** Small coloured label, e.g. "In stock" / "Hidden". The words carry the meaning, the colour only helps. */
export default function Badge({ tone = "plain", children }) {
  return (
    <span className={`inline-block rounded-full border px-3 py-0.5 text-base font-bold ${TONES[tone]}`}>
      {children}
    </span>
  );
}
