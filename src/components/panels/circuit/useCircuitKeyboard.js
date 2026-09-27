import { useEffect, useRef } from "react";
import { gateCovering } from "../../../circuit/circuitDescription.js";
import { clampCell as clampCursor, occupiedColumns, rangeFromCells } from "../../../circuit/circuitRange.js";
import { appStore } from "../../../state/appStore.js";

/**
 * @param {!HTMLElement} host The circuit's scroll container.
 * @param {!{col: !int, row: !int}} cell
 * @returns {!{x: !number, y: !number}} The client point at the cell's top right, where a menu the
 *     keyboard opens there sits.
 */
function cellClientPoint(host, cell) {
  const { panelDeps: deps, zoom } = appStore.getState();
  const rect = deps.syncArea(deps.displayed.getState().value).displayedCircuit.gateRect(cell.row, cell.col);
  const box = host.getBoundingClientRect();
  return { x: box.left - host.scrollLeft + rect.right() * zoom, y: box.top - host.scrollTop + rect.y * zoom };
}

const MOVES = Object.freeze({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] });

/**
 * The circuit by keyboard alone, while the circuit itself has the focus. The arrow keys move a cell
 * cursor over the wires and columns, and Shift with them selects from where the cursor was, the way
 * a box dragged from there would; Home and End go to the first column and to the empty one after the
 * last. Return does what a click on the gate there does - opens its parameter, its Bloch sphere or
 * its values - or opens its menu when a click does nothing; Shift-F10 or the menu key opens the menu
 * of the gate or selection there. Escape lets the cursor go when nothing is selected.
 *
 * The cursor is also where a gate chosen from the palette with the keyboard lands, and a paste,
 * and with nothing selected the selection's keys act on its gate (useSelectionShortcuts.js). A
 * press on the canvas lets it go, so the pointer and the keyboard never disagree about a cell.
 *
 * @param {!{current: (null|!HTMLElement)}} canvasDivRef The circuit's scroll container, which holds
 *     the circuit's tab stop.
 * @param {!function(!{col: !int, row: !int, gate: !Gate}): !boolean} activate Does what a click on
 *     the gate does; false when a click does nothing.
 */
function useCircuitKeyboard(canvasDivRef, activate) {
  const activateRef = useRef(activate);
  activateRef.current = activate;
  useEffect(() => {
    const element = canvasDivRef.current;
    if (element === null) {
      return undefined;
    }
    /** Where a run of Shift and the arrows started. */
    let anchor = undefined;
    const current = () => appStore.getState().panelDeps?.displayed.getState().value.displayedCircuit.circuitDefinition;
    const place = (cell) => appStore.setState({ circuitCursor: cell });

    const openMenu = (circuit, cursor) => {
      const found = gateCovering(circuit, cursor);
      const at = cellClientPoint(element, found ?? cursor);
      if (found !== undefined) {
        appStore.setState({ gateMenu: { ...found, ...at, viaKeyboard: true } });
        return true;
      }
      const range = appStore.getState().selectionActions?.range();
      if (range !== undefined && cursor.col >= range.colStart && cursor.col < range.colEnd &&
          cursor.row >= range.wireStart && cursor.row < range.wireEnd) {
        appStore.setState({ selectionMenu: { ...at, viaKeyboard: true } });
        return true;
      }
      return false;
    };

    const onKeyDown = (event) => {
      if (event.target !== element || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const circuit = current();
      const selection = appStore.getState().selectionActions;
      if (circuit === undefined || selection === undefined) {
        return;
      }
      const cursor = appStore.getState().circuitCursor;
      const range = selection.range();
      const start = cursor ?? (range === undefined ? { col: 0, row: 0 } : { col: range.colStart, row: range.wireStart });

      if (event.key in MOVES || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        let next = start;
        if (cursor !== undefined) {
          const [dc, dr] = MOVES[event.key] ?? [0, 0];
          next = clampCursor(circuit, {
            col: event.key === "Home" ? 0 : event.key === "End" ? occupiedColumns(circuit) : cursor.col + dc,
            row: cursor.row + dr,
          });
        }
        if (event.shiftKey) {
          anchor ??= start;
          selection.select(rangeFromCells(anchor, next));
        } else {
          anchor = undefined;
          selection.clear();
        }
        place(next);
        return;
      }
      if (cursor === undefined) {
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const found = gateCovering(circuit, cursor);
        if (found !== undefined && !activateRef.current(found)) {
          openMenu(circuit, cursor);
        }
      } else if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
        if (openMenu(circuit, cursor)) {
          event.preventDefault();
        }
      } else if (event.key === "Escape" && range === undefined) {
        event.preventDefault();
        anchor = undefined;
        place(undefined);
      }
    };

    // Tabbing to the circuit shows the cursor at once, so the keyboard always knows where it is. A
    // press that focuses it is the pointer's, and shows none - even when the press's own handler
    // moves the focus there from script, which the browser can count as keyboard focus.
    let pressing = false;
    const onRelease = () => {
      pressing = false;
    };
    const onFocus = () => {
      if (!pressing && appStore.getState().circuitCursor === undefined && element.matches(":focus-visible")) {
        const circuit = current();
        const range = appStore.getState().selectionActions?.range();
        if (circuit !== undefined) {
          place(clampCursor(circuit, range === undefined ? { col: 0, row: 0 } : { col: range.colStart, row: range.wireStart }));
        }
      }
    };
    const onPointerDown = () => {
      pressing = true;
      anchor = undefined;
      if (appStore.getState().circuitCursor !== undefined) {
        place(undefined);
      }
    };

    element.addEventListener("keydown", onKeyDown);
    element.addEventListener("focus", onFocus);
    element.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onRelease, true);
    window.addEventListener("pointercancel", onRelease, true);
    return () => {
      element.removeEventListener("keydown", onKeyDown);
      element.removeEventListener("focus", onFocus);
      element.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onRelease, true);
      window.removeEventListener("pointercancel", onRelease, true);
    };
  }, [canvasDivRef]);
}

export { useCircuitKeyboard };
