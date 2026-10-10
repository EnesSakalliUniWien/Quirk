import { useEffect, useLayoutEffect, useReducer } from "react";
import { useStore } from "zustand";
import {
  describeCell,
  describeCircuit,
  gateCovering,
} from "../../../circuit/circuitDescription.js";
import { clampCell } from "../../../circuit/circuitRange.js";
import { appStore } from "../../../state/appStore.js";

/** How far the cursor's ring stands off the cell, so it clears the gate's own hover ring. */
const RING_PADDING = 3;
/** How much room the cursor keeps from the edge of the visible area when it scrolls into view. */
const VIEW_MARGIN = 12;

/**
 * What the circuit says to someone who does not see it, and the keyboard's cell cursor for someone
 * who does: a summary of the circuit, the state its grid shows, and its keys, which the circuit's
 * tab stop is described by; a live line that names the cell the cursor is on and what is in it,
 * which a screen reader reads out as the cursor moves and as an edit changes that cell; and a ring
 * around the cell, drawn over the canvas in its scroll content, at the drawing's zoom.
 *
 * @param {!{host: !{current: (null|!HTMLElement)}}} props host is the circuit's scroll container.
 */
function CircuitCursor({ host }) {
  const deps = useStore(appStore, (s) => s.panelDeps);
  return deps === undefined ? (
    <Speech summary="" cell="" />
  ) : (
    <Cursor deps={deps} host={host} />
  );
}

/**
 * @param {!{summary: !string, cell: !string}} props
 */
function Speech({ summary, cell }) {
  const output = useStore(appStore, (s) => s.outputSummary);
  return (
    <>
      <p id="circuit-summary" className="visually-hidden">
        {summary}
      </p>
      <p id="circuit-output" className="visually-hidden">
        {output}
      </p>
      <p id="circuit-keys" className="visually-hidden">
        Arrow keys move between cells, and Shift with them selects. Return opens
        the gate in the cell. Shift-F10 opens its menu. Delete removes it. A
        gate chosen in the Gates list with Return lands in the cell.
      </p>
      <p id="circuit-cursor-status" className="visually-hidden" role="status">
        {cell}
      </p>
    </>
  );
}

function Cursor({ deps, host }) {
  const cursor = useStore(appStore, (s) => s.circuitCursor);
  const zoom = useStore(appStore, (s) => s.zoom);
  const circuit = useStore(
    deps.displayed,
    (s) => s.value.displayedCircuit.circuitDefinition,
  );
  // The circuit centres in the cell, so a resized cell moves the cursor's ring without a new state.
  const [, resized] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    const observer = new ResizeObserver(resized);
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [host]);

  const cell = cursor === undefined ? undefined : clampCell(circuit, cursor);
  let rect = undefined;
  if (cell !== undefined) {
    const shown = deps.syncArea(
      deps.displayed.getState().value,
    ).displayedCircuit;
    const found = gateCovering(circuit, cell);
    rect = (
      found === undefined
        ? shown.gateRect(cell.row, cell.col)
        : shown.gateRect(
            found.row,
            found.col,
            found.gate.width,
            found.gate.height,
          )
    ).paddedBy(RING_PADDING);
  }

  // Keeps the ring in view as the arrow keys move it, scrolling only the circuit, never the page.
  const left = rect === undefined ? undefined : rect.x * zoom;
  const top = rect === undefined ? undefined : rect.y * zoom;
  const right = rect === undefined ? undefined : rect.right() * zoom;
  const bottom = rect === undefined ? undefined : rect.bottom() * zoom;
  useLayoutEffect(() => {
    const view = host.current;
    if (left === undefined || view === null) {
      return;
    }
    if (left < view.scrollLeft + VIEW_MARGIN) {
      view.scrollLeft = Math.max(0, left - VIEW_MARGIN);
    } else if (right > view.scrollLeft + view.clientWidth - VIEW_MARGIN) {
      view.scrollLeft = right - view.clientWidth + VIEW_MARGIN;
    }
    if (top < view.scrollTop + VIEW_MARGIN) {
      view.scrollTop = Math.max(0, top - VIEW_MARGIN);
    } else if (bottom > view.scrollTop + view.clientHeight - VIEW_MARGIN) {
      view.scrollTop = bottom - view.clientHeight + VIEW_MARGIN;
    }
  }, [host, left, top, right, bottom]);

  return (
    <>
      <Speech
        summary={describeCircuit(circuit)}
        cell={cell === undefined ? "" : describeCell(circuit, cell)}
      />
      {rect !== undefined && (
        <div
          className="circuit-cursor"
          aria-hidden="true"
          style={{
            left: `${rect.x * zoom}px`,
            top: `${rect.y * zoom}px`,
            width: `${rect.w * zoom}px`,
            height: `${rect.h * zoom}px`,
          }}
        />
      )}
    </>
  );
}

export { CircuitCursor };
