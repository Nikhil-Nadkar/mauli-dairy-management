// Shared display helpers. Quantities arrive from the API in BASE units (litres / kg) as strings.
// Every helper takes an optional language ("en" or "mr"); English is the default.

const UNIT_WORDS = {
  en: { ml: "ml", L: "L", g: "g", kg: "kg", litres: "litres" },
  mr: { ml: "मि.ली.", L: "लि.", g: "ग्रॅ.", kg: "किलो", litres: "लिटर" },
};
const words = (lang) => UNIT_WORDS[lang] ?? UNIT_WORDS.en;

/** Short unit: "L" / "kg" */
export const unitShort = (baseUnit, lang = "en") => (baseUnit === "litre" ? words(lang).L : words(lang).kg);

/** Unit written next to number boxes: "litres" / "kg" */
export const unitLong = (baseUnit, lang = "en") => (baseUnit === "litre" ? words(lang).litres : words(lang).kg);

const trim = (n) => Number(n.toFixed(3)).toString();

/** 0.25 (litre) -> "250 ml";  1.5 (litre) -> "1.5 L";  0.1 (kg) -> "100 g";  2 (kg) -> "2 kg" */
export function formatQuantity(quantity, baseUnit, lang = "en") {
  const n = Number(quantity);
  const w = words(lang);
  if (n > 0 && n < 1) return `${Math.round(n * 1000)} ${baseUnit === "litre" ? w.ml : w.g}`;
  return `${trim(n)} ${unitShort(baseUnit, lang)}`;
}

/** 60 -> "₹60";  62.5 -> "₹62.50" (Indian digit grouping) */
export function formatRupees(value) {
  const n = Number(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** "₹60/L" */
export const formatPricePerUnit = (value, baseUnit, lang = "en") =>
  `${formatRupees(value)}/${unitShort(baseUnit, lang)}`;

// How the shop says common amounts: "Pav kilo" = 250 g, "Half litre" = 500 ml, "Paun kilo" = 750 g.
const SHOP_WORDS = {
  en: { 250: "Pav", 500: "Half", 750: "Paun", litre: "litre", litres: "litres", kilo: "kilo" },
  mr: { 250: "पाव", 500: "अर्धा", 750: "पाऊण", litre: "लिटर", litres: "लिटर", kilo: "किलो" },
};

/**
 * Label of a quick-amount button, built from its quantity (the saved label is not shown).
 * Returns { main, detail }: main is what people say, detail the exact amount when main is a word.
 *   0.25 kg -> { main: "Pav kilo", detail: "250 g" }     2 L -> { main: "2 litres", detail: null }
 */
export function quickLabel(quick, baseUnit, lang = "en") {
  const w = SHOP_WORDS[lang] ?? SHOP_WORDS.en;
  const n = Number(quick.quantity);
  const milli = Math.round(n * 1000);
  const litre = baseUnit === "litre";

  if (w[milli]) return { main: `${w[milli]} ${litre ? w.litre : w.kilo}`, detail: formatQuantity(n, baseUnit, lang) };
  if (n < 1) return { main: formatQuantity(n, baseUnit, lang), detail: null };
  const unit = litre ? (n === 1 ? w.litre : w.litres) : words(lang).kg;
  return { main: `${trim(n)} ${unit}`, detail: null };
}

// ---- quick buttons: what the owner types (value + unit) -> {label, quantity in base units} ----
export const QUICK_UNITS = {
  litre: ["ml", "litre"],
  kg: ["g", "kg"],
};

/** Returns { label, quantity } or { error } where error is a translation key. */
export function makeQuickButton(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return { error: "product.quickErrZero" };

  const small = unit === "ml" || unit === "g";
  const thousandths = small ? v : v * 1000;
  if (Math.abs(thousandths - Math.round(thousandths)) > 1e-9) {
    return { error: small ? "product.quickErrWhole" : "product.quickErrDecimals" };
  }
  const quantity = (Math.round(thousandths) / 1000).toFixed(3);
  const baseUnit = unit === "ml" || unit === "litre" ? "litre" : "kg";
  // Saved in the same English words the screen shows, e.g. "Pav kilo".
  return { label: quickLabel({ quantity }, baseUnit, "en").main, quantity };
}

// Marathi month names, but ordinary 0-9 digits (easier to read next to rupee amounts).
const locale = (lang) => (lang === "mr" ? "mr-IN-u-nu-latn" : "en-IN");

/** "2026-11-01" -> "1 Nov" */
export function formatDay(isoDate, lang = "en") {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale(lang), { day: "numeric", month: "short" });
}

/** ISO timestamp -> "1 Nov, 4:15 pm" in the viewer's timezone */
export function formatDateTime(iso, lang = "en") {
  return new Date(iso).toLocaleString(locale(lang), {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
