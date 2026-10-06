import { setColourScheme } from "../appearance/colourScheme.js";
import { applyTheme } from "./applyTheme.js";

/** Light only when the system says so; a browser that cannot say gets the dark palette. */
const LIGHT_QUERY = "(prefers-color-scheme: light)";

/**
 * @returns {'light'|'dark'} The palette the system's appearance asks for. The app has no appearance
 *     setting of its own: it looks the way the system does, as every other app on the device does.
 */
export function systemColourScheme() {
  try {
    return window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/**
 * Apply the system palette in place. Theme snapshots and redraw subscribers update without
 * replacing the document, so focus, drafts, undo history and playback remain the user's.
 * @param {() => ('light'|'dark')} shownScheme
 * @param {(next: 'light'|'dark') => void} [apply]
 * @returns {() => void} Stop following the system.
 */
export function followSystemColourScheme(
  shownScheme,
  apply = (next) => {
    setColourScheme(next);
    applyTheme();
  },
) {
  const query = window.matchMedia(LIGHT_QUERY);
  const changed = () => {
    const next = systemColourScheme();
    if (next !== shownScheme()) apply(next);
  };
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
}
