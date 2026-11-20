import { useState } from "react";

/**
 * Runs `reset` (during render) when `value` changes, e.g. clear a half-typed form when the owner
 * switches branch. This is React's recommended way to adjust state when a prop changes.
 */
export function useOnChange(value, reset) {
  const [previous, setPrevious] = useState(value);
  if (previous !== value) {
    setPrevious(value);
    reset();
  }
}
