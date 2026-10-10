import { shortcut } from "../../../browser/platform.js";
import { appStore } from "../../../state/appStore.js";
import { openPanel } from "../../dock.jsx";
import { notify } from "../../ui/toasts.jsx";

/**
 * What the selection's bar, its menu and its keys do, in one place so the three stay alike: each
 * command acts through SelectionActions and says what happened in a toast.
 */

/**
 * @param {!CircuitRange} range
 * @returns {!string} Its size, such as "3 columns × 2 wires".
 */
function describeRange({ colStart, colEnd, wireStart, wireEnd }) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return `${plural(colEnd - colStart, "column")} × ${plural(wireEnd - wireStart, "wire")}`;
}

/**
 * @param {!Object} dependency One of SelectionActions.outsideDependencies().
 * @returns {!string}
 */
function describeDependency(dependency) {
  switch (dependency.kind) {
    case "control":
      return `the control on q${dependency.row}`;
    case "swap":
      return `the swap half on q${dependency.row}`;
    default:
      return `${dependency.key} from outside`;
  }
}

/**
 * @param {!Array.<!Object>} dependencies
 * @returns {undefined|!string} What a copy of the selection leaves behind, if anything.
 */
function leftBehind(dependencies) {
  if (dependencies.length === 0) {
    return undefined;
  }
  const named = dependencies.slice(0, 2).map(describeDependency);
  const more =
    dependencies.length > 2 ? ` and ${dependencies.length - 2} more` : "";
  return `Not copied: ${named.join(", ")}${more}.`;
}

/**
 * @param {!SelectionActions} actions
 * @param {!function(!string): (void|!Promise)} write Puts text on the clipboard.
 * @returns {!Promise.<!boolean>}
 */
async function copySelection(actions, write) {
  const range = actions.range();
  const text = actions.copyText();
  if (range === undefined || text === undefined) {
    return false;
  }
  try {
    await write(text);
  } catch (ex) {
    console.warn("Clipboard copy failed.", ex);
    notify(
      "Nothing copied",
      "The browser did not allow access to the clipboard.",
    );
    return false;
  }
  notify(
    `Copied ${describeRange(range)}`,
    leftBehind(actions.outsideDependencies()),
  );
  return true;
}

/**
 * Copies, and only once the copy is on the clipboard deletes, so a refused clipboard loses nothing.
 *
 * @param {!SelectionActions} actions
 * @param {!function(!string): (void|!Promise)} write
 * @returns {!Promise.<!boolean>}
 */
async function cutSelection(actions, write) {
  const range = actions.range();
  const text = actions.copyText();
  if (range === undefined || text === undefined) {
    return false;
  }
  try {
    await write(text);
  } catch (ex) {
    console.warn("Clipboard cut failed.", ex);
    notify("Nothing cut", "The browser did not allow access to the clipboard.");
    return false;
  }
  actions.remove();
  notify(`Cut ${describeRange(range)}`, `${shortcut("Z")} puts it back.`);
  return true;
}

/**
 * @param {!SelectionActions} actions
 * @returns {!boolean}
 */
function deleteSelection(actions) {
  const range = actions.range();
  if (range === undefined || !actions.remove()) {
    return false;
  }
  notify(`Deleted ${describeRange(range)}`, `${shortcut("Z")} puts it back.`);
  return true;
}

/**
 * Switches the selected gates off, or back on when every one of them is off already. Off, a gate
 * keeps its slot but the simulation skips it.
 *
 * @param {!SelectionActions} actions
 * @returns {!boolean}
 */
function toggleSelectionActive(actions) {
  const range = actions.range();
  const off = !actions.allDeactivated();
  if (range === undefined || !actions.setDeactivated(off)) {
    return false;
  }
  notify(
    `${off ? "Deactivated" : "Activated"} ${describeRange(range)}`,
    `${shortcut("Z")} undoes it.`,
  );
  return true;
}

/**
 * @param {!SelectionActions} actions
 * @param {!string} text
 * @param {undefined|!{col: !int, row: !int}} at
 * @returns {!boolean} Whether the text was a circuit, pasted or refused with a reason; false leaves
 *     other text to whatever else takes a paste.
 */
function pasteCircuit(actions, text, at) {
  const result = actions.paste(text, at);
  if (result.notCircuit) {
    return false;
  }
  if (result.error !== undefined) {
    notify("Nothing pasted", result.error);
  } else {
    notify(`Pasted ${describeRange(result.range)}`, "Inserted as new columns.");
  }
  return true;
}

/**
 * Opens Create gate on its Circuit tab, with the selection's columns and wires filled in.
 *
 * @param {!SelectionActions} actions
 */
function makeGateFromSelection(actions) {
  const range = actions.range();
  if (range === undefined) {
    return;
  }
  appStore.setState({
    forgeCircuitDraft: {
      cols: `${range.colStart + 1}:${range.colEnd}`,
      rows: `${range.wireStart + 1}:${range.wireEnd}`,
    },
  });
  openPanel("forge");
}

export {
  copySelection,
  cutSelection,
  deleteSelection,
  toggleSelectionActive,
  pasteCircuit,
  makeGateFromSelection,
  describeRange,
  describeDependency,
  shortcut,
};
