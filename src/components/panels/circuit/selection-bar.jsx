import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { useStore } from "zustand";
import { CopyIcon, PowerIcon, PowerOffIcon, ScissorsIcon, Trash2Icon, WandSparklesIcon, XIcon } from "lucide-react";
import { appStore } from "../../../state/appStore.js";
import { selectionRect } from "../../../editor/interaction/RangeSelection.js";
import { Button } from "../../ui/button.jsx";
import {
  copySelection, cutSelection, deleteSelection, describeDependency, describeRange, makeGateFromSelection, shortcut,
  toggleSelectionActive,
} from "./selectionCommands.js";

/** How much room the bar needs above the selection; with less, it sits below instead. */
const BAR_CLEARANCE = 44;
/** How far the bar keeps from the edges of the circuit's visible area. */
const BAR_MARGIN = 4;

const writeClipboard = (text) => navigator.clipboard.writeText(text);

/**
 * The selection's actions, in a bar at its top edge: copy, cut, delete, make a gate of it, switch
 * its gates off or on, or let it go. It lives in the circuit's scroll content, at the drawing's zoom, so it stays with the
 * selection as the circuit scrolls and zooms. Under the buttons it names what the selected gates
 * rely on from outside the selection, which a copy leaves behind, and offers to take those wires in.
 *
 * @param {!{host: !{current: (null|!HTMLElement)}}} props host is the scroll container.
 */
function SelectionBar({ host }) {
  const deps = useStore(appStore, (s) => s.panelDeps);
  const actions = useStore(appStore, (s) => s.selectionActions);
  const selection = useStore(appStore, (s) => s.circuitSelection);
  return deps === undefined || actions === undefined || selection === undefined ? null :
    <Bar deps={deps} actions={actions} host={host} />;
}

function Bar({ deps, actions, host }) {
  const zoom = useStore(appStore, (s) => s.zoom);
  const shown = useStore(deps.displayed, (s) => s.value);
  // The circuit centres in the cell, so a resized cell moves the selection without a new state; and
  // the bar keeps inside the visible area, which scrolling moves.
  const [, moved] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    const element = host.current;
    const observer = new ResizeObserver(moved);
    observer.observe(element);
    element.addEventListener("scroll", moved, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", moved);
    };
  }, [host]);
  const bar = useRef(null);
  const [barWidth, setBarWidth] = useState(0);
  useLayoutEffect(() => {
    const width = bar.current?.offsetWidth;
    if (width !== undefined && width !== barWidth) {
      setBarWidth(width);
    }
  });

  // A drag in progress shows another circuit, and a new box replaces the selection when it ends.
  const range = shown.hand.isBusy() ? undefined : actions.range();
  if (range === undefined) {
    return null;
  }
  const rect = selectionRect(deps.syncArea(shown).displayedCircuit.geometry(), range);
  const dependencies = actions.outsideDependencies();
  const outsideWires = [...new Set(dependencies.filter((d) => d.row !== undefined).map((d) => d.row))];
  const includeWires = () => actions.select({
    ...range,
    wireStart: Math.min(range.wireStart, ...outsideWires),
    wireEnd: Math.max(range.wireEnd, ...outsideWires.map((row) => row + 1)),
  });
  const above = rect.y * zoom >= BAR_CLEARANCE;
  const size = describeRange(range);
  // At the selection's left edge, moved in where that would leave part of the bar out of view.
  const view = host.current;
  const left = view === null ? rect.x * zoom : Math.max(view.scrollLeft + BAR_MARGIN,
    Math.min(view.scrollLeft + view.clientWidth - barWidth - BAR_MARGIN, rect.x * zoom));

  return (
    <div
      ref={bar}
      className="selection-bar"
      data-placement={above ? "above" : "below"}
      role="group"
      aria-label={`Selection, ${size}`}
      style={{ left: `${left}px`, top: `${(above ? rect.y : rect.bottom()) * zoom}px` }}
    >
      <div className="selection-bar-actions">
        <span className="selection-bar-size">{size}</span>
        <BarButton action="copy" icon={CopyIcon} label={`Copy (${shortcut("C")})`}
          onClick={() => copySelection(actions, writeClipboard)} />
        <BarButton action="cut" icon={ScissorsIcon} label={`Cut (${shortcut("X")})`}
          onClick={() => cutSelection(actions, writeClipboard)} />
        <BarButton action="delete" icon={Trash2Icon} label="Delete (Delete)"
          onClick={() => deleteSelection(actions)} />
        <BarButton action="make-gate" icon={WandSparklesIcon} label="Make a gate of it"
          onClick={() => makeGateFromSelection(actions)} />
        {/* The gate menu's switch, here too, so it needs no right click or touch and hold. */}
        {actions.allDeactivated() ? (
          <BarButton action="activate" icon={PowerIcon} label="Activate" onClick={() => toggleSelectionActive(actions)} />
        ) : (
          <BarButton action="deactivate" icon={PowerOffIcon} label="Deactivate"
            onClick={() => toggleSelectionActive(actions)} />
        )}
        <BarButton action="clear" icon={XIcon} label="Clear selection (Esc)" onClick={() => actions.clear()} />
      </div>
      {dependencies.length > 0 && (
        <p className="selection-bar-note">
          <span>Relies on {dependencies.map(describeDependency).join(", ")}.</span>
          {outsideWires.length > 0 && (
            <button type="button" className="selection-bar-include" onClick={includeWires}>
              Include {outsideWires.map((row) => `q${row}`).join(", ")}
            </button>
          )}
        </p>
      )}
    </div>
  );
}

function BarButton({ action, icon: Icon, label, onClick }) {
  return (
    <Button size="icon" data-action={action} aria-label={label} title={label} onClick={onClick}>
      <Icon aria-hidden="true" />
    </Button>
  );
}

export { SelectionBar };
