// Reasons for a stock correction. They are SAVED in English (so the history reads the same for
// everyone) and SHOWN in the chosen language.
export const REASONS = ["Damaged", "Spoiled", "Wasted", "Counting mistake", "Other"];

/** The text saved on the server: "Spoiled", "Spoiled: left in the sun", or the typed reason for "Other". */
export function reasonToSave(reason, note) {
  const extra = note.trim();
  if (reason === "Other") return extra;
  return extra ? `${reason}: ${extra}` : reason;
}

/** Translate a saved reason back for display ("Spoiled: left in the sun" -> "नासले: left in the sun"). */
export function showReason(saved, t) {
  if (!saved) return "";
  const known = REASONS.find((r) => saved === r || saved.startsWith(`${r}: `));
  return known ? t(`reasons.${known}`) + saved.slice(known.length) : saved;
}
