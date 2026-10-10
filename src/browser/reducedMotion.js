/** The system's Reduce Motion setting, as the browser reports it. */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * @returns {!boolean} Whether Reduce Motion is on: animations that run by themselves should stand
 *     still, and moves between states should land at once.
 */
export function prefersReducedMotion() {
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * @param {!function(!boolean): void} listener Told whether Reduce Motion is on each time it changes.
 * @returns {!function(): void} Stops listening.
 */
export function onReducedMotionChange(listener) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  const changed = (event) => listener(event.matches);
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
}
