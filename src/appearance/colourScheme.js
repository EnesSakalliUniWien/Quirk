/**
 * The active colour scheme, set once at startup before any theme module evaluates. It is always a
 * palette name; the browser resolves a 'system' preference before setting it.
 */
let scheme = "dark";

export function setColourScheme(next) {
  if (next !== "light" && next !== "dark") {
    throw new RangeError(`Unknown colour scheme: ${next}`);
  }
  scheme = next;
}

export function colourScheme() {
  return scheme;
}
