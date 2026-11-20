import { useState } from "react";
import { storage } from "../utils/storage.js";

const KEY = "dairy_text_size";

/** Apply the saved text size. Called once when the app starts. */
export function applySavedTextSize() {
  document.documentElement.dataset.textSize = storage.get(KEY) === "large" ? "large" : "normal";
}

/** "normal" or "large" text, remembered on this phone. */
export function useTextSize() {
  const [size, setSizeState] = useState(() => (storage.get(KEY) === "large" ? "large" : "normal"));

  const setSize = (next) => {
    storage.set(KEY, next);
    document.documentElement.dataset.textSize = next;
    setSizeState(next);
  };

  return [size, setSize];
}
