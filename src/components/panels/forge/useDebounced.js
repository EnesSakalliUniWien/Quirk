import { useEffect, useState } from "react";

/** Milliseconds. Typing must not recompute and repaint a preview on every keystroke. */
const PREVIEW_DEBOUNCE_MILLIS = 100;

/**
 * @param {!string} key The inputs, joined into one value. A string rather than the array itself:
 *     a fresh array every render would retrigger the timer forever.
 * @param {!number} millis
 * @returns {!string} The key, but no more often than once per `millis`.
 */
function useDebounced(key, millis) {
  const [settled, setSettled] = useState(key);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(key), millis);
    return () => clearTimeout(timer);
  }, [key, millis]);
  return settled;
}

export { useDebounced, PREVIEW_DEBOUNCE_MILLIS };
