/**
 * The icons the app draws itself, kept as files rather than as markup inside a module: Lucide's
 * minus, plus and x, for the two corners of the page built without React - the zoom cluster over
 * the circuit and the error banner. Every other icon comes from lucide-react.
 *
 * Each file is drawn the way Lucide draws: a 24px grid, currentColor, round caps and joins, and
 * ICON_STROKE_WIDTH, so a copied icon sits at the same weight as a lucide-react one beside it.
 * test/resources/icons.test.js holds them to that.
 */

import minus from "./minus.svg?raw";
import plus from "./plus.svg?raw";
import x from "./x.svg?raw";

/** The stroke every icon in the app is drawn with, on Lucide's 24px grid. */
const ICON_STROKE_WIDTH = 1.5;

/** @type {!Object.<!string, !string>} */
const ICON_MARKUP = Object.freeze({ minus, plus, x });

/**
 * One icon as an element, for the parts of the page built without React. The size is the
 * stylesheet's to decide, as it is for a lucide-react icon.
 *
 * @param {!string} name
 * @returns {!Element}
 */
function iconElement(name) {
  const template = document.createElement("template");
  template.innerHTML = ICON_MARKUP[name].trim();
  const svg = template.content.firstElementChild;
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

export { ICON_MARKUP, ICON_STROKE_WIDTH, iconElement };
