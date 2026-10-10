/**
 * The active colour scheme, selected at startup and updated without replacing the session. It is always a
 * palette name: the one the system's appearance asks for, which the browser reads before setting it.
 */
/** @type {'light'|'dark'} */
let scheme = "dark";
const listeners = new Set();

/** @param {'light'|'dark'} next */
export function setColourScheme(next) {
  if (next !== "light" && next !== "dark") {
    throw new RangeError(`Unknown colour scheme: ${next}`);
  }
  if (scheme === next) return;
  scheme = next;
  for (const listener of listeners) listener();
}

export function colourScheme() {
  return scheme;
}

/**
 * Subscribe to a new immutable appearance snapshot.
 * @param {() => void} listener
 * @returns {() => void} Unsubscribe without changing the active snapshot.
 */
export function onColourSchemeChange(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
