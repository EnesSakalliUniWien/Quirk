import { useRef } from "react";
import { flushSync } from "react-dom";
import { useStore } from "zustand";

import {RenderCanvas} from '../../../draw/surface/RenderCanvas.jsx';
import { startQuirk } from "../../../app/QuirkApp.js";
import { setErrorBannerHost } from "../../../diagnostics/errorReporter.js";
import { appStore } from "../../../state/appStore.js";
import { openPanel } from "../../dock.jsx";
import { CircuitCursor } from "./circuit-cursor.jsx";
import { GutterEditors } from "./gutter-editors.jsx";
import { GateMenu } from "./gate-menu.jsx";
import { WireDials } from "./wire-dial.jsx";
import { ForgeRangeHighlight } from './forge-range-highlight.jsx';
import { SelectionBar } from "./selection-bar.jsx";
import { SelectionMenu } from "./selection-menu.jsx";
import { useCircuitKeyboard } from "./useCircuitKeyboard.js";
import { useSelectionShortcuts } from "./useSelectionShortcuts.js";
import { ExamplesMenu } from "../../toolbar/examples-menu.jsx";

// Clicking a parametrized gate's button, a Bloch sphere or an amplitude display opens its panel, and
// so does Return on it. The target is transient state rather than a panel parameter, so it never
// reaches the saved layout.
const openGateParamEditor = (found) => {
  appStore.setState({ gateParamTarget: found });
  openPanel("gate-param");
};
const openBlochSphereView = (target) => {
  appStore.setState({ blochTarget: target });
  openPanel("bloch");
};
const openComplexDisplay = (target) => {
  appStore.setState({ complexDisplayTarget: target });
  openPanel("complex-display");
};

/**
 * What a click on the gate does, for Return on its cell.
 *
 * @param {!{col: !int, row: !int, gate: !Gate}} found
 * @returns {!boolean} Whether the gate has something a click opens.
 */
function activateGate(found) {
  if (found.gate.paramDialog !== undefined) {
    openGateParamEditor(found);
  } else if (/^(Amps[0-9]+|Density[0-9]*)$/.test(found.gate.serializedId)) {
    openComplexDisplay(found);
  } else if (found.gate.serializedId === "Bloch") {
    openBlochSphereView(found);
  } else {
    return false;
  }
  return true;
}

/**
 * What an empty circuit shows: how to put the first gate on it, by pointer or by keyboard, and where
 * finished circuits are. It lets presses and drops through to the canvas under it.
 */
function EmptyCircuitHint() {
  const empty = useStore(appStore, (s) => s.booted && !s.circuitAvailability.canClearCircuit);
  return empty ? (
    <div className="circuit-empty-hint">
      <p>
        Drag a gate from Gates onto a wire - the dashed slot on q0 is a good start - or select one
        there and press Return.
      </p>
      {/* The hint lets drops through to the canvas; only this button takes a press. */}
      <ExamplesMenu worded />
    </div>
  ) : null;
}

/**
 * The circuit itself, as a dock panel: the scrolling cell, its canvas, the bar under it holding the
 * zoom and the overview, and the error banner that floats over them.
 *
 * React owns the canvas, Pixi Application and retained scene. startQuirk connects editor state,
 * simulation and frame scheduling, and publishes the shell's dependencies through the app store.
 * The ids are style and test hooks only.
 *
 * The drawing is one picture, so the scroll cell around it is what assistive technology meets: an
 * application named Circuit, described by the circuit's size and its keys, and a live line naming
 * the cell the keyboard is on (circuit-cursor.jsx, useCircuitKeyboard.js).
 */
function CircuitPanel() {
  const canvasRef = useRef(null);
  const canvasDivRef = useRef(null);
  const scrollSpacerRef = useRef(null);
  const circuitOverlayRef = useRef(null);
  const errorBannerRef = useRef(null);
  const areaRef = useRef(null);
  useSelectionShortcuts(areaRef);
  useCircuitKeyboard(canvasDivRef, activateGate);

  const start = () => {
    setErrorBannerHost(errorBannerRef.current);
    startQuirk({
      canvas: canvasRef.current,
      canvasDiv: canvasDivRef.current,
      scrollSpacer: scrollSpacerRef.current,
      circuitOverlay: circuitOverlayRef.current,
      // Flushed, not batched: the redraw loop starts on the next line, and its first frame should
      // land in a shell that is already showing.
      onReady: () => flushSync(() => appStore.setState({ booted: true })),
      openGateParamEditor,
      openBlochSphereView,
      openComplexDisplay,
      openTape: () => openPanel("tape"),
      openRegisterRename: (name, rect) => {
        appStore.setState({ registerRename: { name, rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h } } });
      },
      openGutterMenu: ({ wire, register, rect, x, y }) =>
        appStore.setState({
          gutterMenu: {
            wire,
            register,
            rect: rect === undefined ? undefined : { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
            x,
            y,
          },
        }),
      // A right click or a touch held still on a gate: the gate, its slot and where it was, for the
      // gate menu.
      openGateMenu: (target) => appStore.setState({ gateMenu: target }),
      // The same inside the selection: where it was, for the selection's menu.
      openSelectionMenu: (at) => appStore.setState({ selectionMenu: at }),
    });
  };

  return (
    <div id="circuit-area" ref={areaRef}>
      <div
        id="canvasDiv"
        ref={canvasDivRef}
        role="application"
        aria-roledescription="circuit editor"
        aria-label="Circuit"
        aria-describedby="circuit-summary circuit-output circuit-keys"
        style={{ touchAction: "manipulation", position: "relative" }}
      >
        <RenderCanvas id="drawCanvas" canvasRef={canvasRef} onReady={start} />
        {/* Carries the scroll extent, so the canvas can stay viewport-sized. */}
        <div id="canvas-scroll-spacer" ref={scrollSpacerRef} aria-hidden="true" />
        {/* The rename box and the wire-label menu sit in the scroll content, over the drawing. */}
        <GutterEditors host={canvasDivRef} />
        {/* The gate menu and the rotation gates' dials sit in the scroll content too, at their gate. */}
        <GateMenu host={canvasDivRef} />
        <WireDials host={canvasDivRef} />
        <ForgeRangeHighlight host={canvasDivRef} />
        {/* The selection's bar and menu sit in the scroll content too, at the selection. */}
        <SelectionBar host={canvasDivRef} />
        <SelectionMenu host={canvasDivRef} />
        {/* And the keyboard's cursor, with what the circuit says about itself. */}
        <CircuitCursor host={canvasDivRef} />
      </div>
      <EmptyCircuitHint />
      <div id="circuit-overlay" ref={circuitOverlayRef} />
      {/* The error banner floats over the circuit; errorReporter.js fills it. */}
      <div id="error-banner-root" ref={errorBannerRef} />
    </div>
  );
}

export { CircuitPanel };
