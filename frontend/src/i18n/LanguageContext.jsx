import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as format from "../utils/format.js";
import { storage } from "../utils/storage.js";
import en from "./en.js";
import mr from "./mr.js";

const DICTIONARIES = { en, mr };
const STORAGE_KEY = "dairy_language";

/** Look up "a.b.c" in a nested dictionary. */
const lookup = (dict, key) => key.split(".").reduce((node, part) => node?.[part], dict);

/** "Hello {name}" + { name: "Asha" } -> "Hello Asha" */
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));

// The server always answers in English. These common answers are shown in Marathi when Marathi is chosen.
const SERVER_MESSAGES = [
  [/^Not enough (?<name>.+)\. Only (?<qty>.+) left\.$/, "server.notEnough"],
  [/^(?<name>.+) is OUT OF STOCK\.$/, "server.outOfStock"],
  [/^Incorrect email or password\.$/, "server.badLogin"],
  [/^This account is turned off/, "server.accountOff"],
  [/^Please log in again\.$/, "server.loginAgain"],
  [/^Only the owner can do this\.$/, "server.ownerOnly"],
  [/^This sale is more than (?<minutes>\d+) minutes old/, "server.undoTooOld"],
  [/^Something went wrong/, "errors.generic"],
  [/^Cannot reach the server/, "errors.network"],
];

function makeLanguage(lang) {
  const dict = DICTIONARIES[lang] ?? en;

  const t = (key, vars = {}) => {
    const text = lookup(dict, key) ?? lookup(en, key);
    return typeof text === "string" ? fill(text, vars) : key;
  };

  const tError = (message) => {
    if (lang === "en" || !message) return message;
    for (const [pattern, key] of SERVER_MESSAGES) {
      const match = message.match(pattern);
      if (match) return t(key, match.groups ?? {});
    }
    return message;
  };

  // Formatters that already know the language, e.g. fmt.qty("0.5", "litre").
  const fmt = {
    qty: (quantity, baseUnit) => format.formatQuantity(quantity, baseUnit, lang),
    rupees: format.formatRupees,
    pricePerUnit: (value, baseUnit) => format.formatPricePerUnit(value, baseUnit, lang),
    unitShort: (baseUnit) => format.unitShort(baseUnit, lang),
    unitLong: (baseUnit) => format.unitLong(baseUnit, lang),
    quickLabel: (quick, baseUnit) => format.quickLabel(quick, baseUnit, lang),
    day: (iso) => format.formatDay(iso, lang),
    dateTime: (iso) => format.formatDateTime(iso, lang),
  };

  return { lang, t, tError, fmt };
}

// Default value lets a component render (in English) even without the provider, e.g. in small tests.
const LanguageContext = createContext({ ...makeLanguage("en"), setLang: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => (storage.get(STORAGE_KEY) === "mr" ? "mr" : "en"));

  const setLang = useCallback((next) => {
    storage.set(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  // Tells the phone which language the page is in (for the right font and screen readers).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ ...makeLanguage(lang), setLang }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** const { t, fmt, tError, lang, setLang } = useT(); */
export const useT = () => useContext(LanguageContext);
