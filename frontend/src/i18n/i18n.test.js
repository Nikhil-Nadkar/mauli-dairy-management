import { describe, expect, it } from "vitest";
import en from "./en.js";
import mr from "./mr.js";

/** All "a.b.c" keys of a nested dictionary. */
const keysOf = (dict, prefix = "") =>
  Object.entries(dict).flatMap(([k, v]) => (typeof v === "string" ? [prefix + k] : keysOf(v, `${prefix}${k}.`)));

const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort();
const lookup = (dict, key) => key.split(".").reduce((node, part) => node?.[part], dict);

describe("translations", () => {
  it("has every English text in Marathi too", () => {
    const missing = keysOf(en).filter((key) => typeof lookup(mr, key) !== "string");
    expect(missing).toEqual([]);
  });

  it("keeps the same {placeholders} in both languages", () => {
    const different = keysOf(en).filter(
      (key) => JSON.stringify(placeholders(lookup(en, key))) !== JSON.stringify(placeholders(lookup(mr, key)))
    );
    expect(different).toEqual([]);
  });
});
