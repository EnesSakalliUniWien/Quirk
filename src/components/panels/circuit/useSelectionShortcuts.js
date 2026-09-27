import { useEffect } from "react";
import { isTypingTarget } from "../../../browser/typingTarget.js";
import { gateCovering } from "../../../circuit/circuitDescription.js";
import { rangeFromCells } from "../../../circuit/circuitRange.js";
import { insertionCellAt } from "../../../editor/interaction/RangeSelection.js";
import { appStore } from "../../../state/appStore.js";
import { copySelection, cutSelection, deleteSelection, pasteCircuit } from "./selectionCommands.js";

/**
 * The selection's keys, while the circuit has the focus - or nothing has - and no text field does:
 * Ctrl/⌘+C copies, Ctrl/⌘+X cuts, Delete or Backspace deletes, Escape lets the selection go and
 * Ctrl/⌘+A selects every gate. Ctrl/⌘+V pastes copied gates as new columns, before the column under
 * the keyboard's cell cursor or the pointer and from the wire under it, or else after the selection
 * or the circuit.
 *
 * With nothing selected, the keyboard's cell cursor stands in for the selection while the circuit
 * has the focus (useCircuitKeyboard.js): the keys copy, cut or delete the gate in its cell, which
 * becomes the selection first, so the bar shows what they acted on.
 *
 * Copy and cut write through the async clipboard from the key press, which every browser allows
 * there; a paste is read from the paste event, which needs no permission. Text selected in a panel
 * keeps its own copy, and pasted text that is not a circuit is left alone.
 *
 * @param {!{current: (null|!HTMLElement)}} area The circuit's panel.
 */
function useSelectionShortcuts(area) {
  useEffect(() => {
    const inCircuit = (event) => {
      if (event.defaultPrevented || isTypingTarget(event)) {
        return false;
      }
      const active = document.activeElement;
      return active === null || active === document.body || area.current?.contains(active) === true;
    };
    const writeClipboard = (text) => navigator.clipboard.writeText(text);
    /** @returns {undefined|!{col: !int, row: !int}} The keyboard's cell, while the circuit itself has the focus. */
    const keyboardCell = () => {
      const canvas = area.current?.querySelector("#canvasDiv");
      return canvas !== null && canvas !== undefined && document.activeElement === canvas ?
        appStore.getState().circuitCursor : undefined;
    };

    const onKeyDown = (event) => {
      const actions = appStore.getState().selectionActions;
      if (actions === undefined || event.altKey || !inCircuit(event)) {
        return;
      }
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (command && !event.shiftKey && key === "a") {
        if (actions.selectAll()) {
          event.preventDefault();
        }
        return;
      }
      const copies = command && !event.shiftKey && (key === "c" || key === "x");
      const deletes = !command && !event.shiftKey && (key === "delete" || key === "backspace");
      // Text the user selected in the page is theirs to copy.
      if (copies && window.getSelection()?.isCollapsed === false) {
        return;
      }
      if (actions.range() === undefined) {
        const cell = copies || deletes ? keyboardCell() : undefined;
        const found = cell === undefined ? undefined : gateCovering(actions.current(), cell);
        if (found === undefined || !actions.select(rangeFromCells(found, found))) {
          return;
        }
      }
      if (copies) {
        event.preventDefault();
        (key === "c" ? copySelection : cutSelection)(actions, writeClipboard);
      } else if (deletes) {
        event.preventDefault();
        deleteSelection(actions);
      } else if (!command && key === "escape") {
        event.preventDefault();
        actions.clear();
      }
    };

    const onPaste = (event) => {
      const { selectionActions: actions, panelDeps: deps } = appStore.getState();
      const text = event.clipboardData?.getData("text/plain");
      if (actions === undefined || deps === undefined || !text || !inCircuit(event)) {
        return;
      }
      const shown = deps.syncArea(deps.displayed.getState().value);
      const pos = shown.hand.pos;
      const at = keyboardCell() ?? (pos === undefined ? undefined : insertionCellAt(shown.displayedCircuit.geometry(), pos));
      if (pasteCircuit(actions, text, at)) {
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("paste", onPaste);
    };
  }, [area]);
}

export { useSelectionShortcuts };
