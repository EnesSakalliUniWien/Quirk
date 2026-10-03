import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import { PURE_STATE_THRESHOLD } from "../../../engine/math/bloch.js";
import { appStore } from "../../../state/appStore.js";
import { closePanel } from "../../dock.jsx";
import { useCompletedResult } from "../shared/usePlayheadStats.js";
import { AnalyzerFooter } from "./analyzer-footer.jsx";
import { AnalyzerGroup } from "./analyzer-group.jsx";
import { AnalyzerHeader } from "./analyzer-header.jsx";
import { INITIAL_LAYERS, anglesOf, subtitleFor } from "./analyzerModel.js";
import { AxisKey } from "./axis-key.jsx";
import { BlochFigures } from "./bloch-figures.jsx";
import { ExploreControls } from "./explore-controls.jsx";
import { LayerSwitches } from "./layer-switches.jsx";
import { ReadoutSidebar } from "./readout-sidebar.jsx";
import { StepStrip } from "./step-strip.jsx";
import { useBlochFigures } from "./useBlochFigures.js";
import { useCircuitSteps } from "./useCircuitSteps.js";
import { useExploreTransition } from "./useExploreTransition.js";

/**
 * The Bloch sphere analyzer: one qubit read three ways - the sphere seen from above the equator,
 * the meridian that holds θ and the equator that holds ϕ, both face on - with every number beside
 * the controls that change them. Escape closes it, and focus goes back to the circuit.
 *
 * Usage: open it by clicking any Bloch sphere in the circuit; appStore.blochTarget says which
 * ({row, col} for a Bloch gate, {row} for a wire's output). It takes no props.
 *
 * This component owns the analyzer's state - which layers are drawn, which axis is read, which
 * state is shown - and composes the parts that show it, grouped by responsibility: the figures,
 * what they draw, which state they show, and the readout. Where each part comes from:
 *   - the numbers and the rules about what is undefined: src/engine/math/bloch.js, formatted for
 *     the panel by ./analyzerModel.js;
 *   - the drawing: ./useBlochFigures.js, through the painters in src/draw/displays/;
 *   - every colour: src/config/Theme.js, through CanvasTheme and the --bloch-axis-* variables;
 *   - the controls: Base UI and the app's own Button.
 */
function BlochPanel() {
  const deps = useStore(appStore, (s) => s.panelDeps);
  const target = useStore(appStore, (s) => s.blochTarget);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  // Hovering an axis previews it; clicking keeps it, so a reading can be held while the sphere
  // is dragged with the other hand.
  const [pinnedAxis, setPinnedAxis] = useState(
    /** @type {string | undefined} */ (undefined),
  );
  const [hoverAxis, setHoverAxis] = useState(
    /** @type {string | undefined} */ (undefined),
  );
  const [mode, setMode] = useState(
    /** @type {import("./analyzerModel.js").ViewMode} */ ({ kind: "circuit" }),
  );
  const focusAxis = hoverAxis ?? pinnedAxis;

  // One sample of the simulation for the steps and the figures alike, so they change together.
  const completed = useCompletedResult();
  const { steps, currentStep } = useCircuitSteps(target, completed);
  const figures = useBlochFigures({
    deps,
    completed,
    target,
    mode,
    layers,
    focusAxis,
    steps,
    currentStep,
  });
  const { explore, exploreAngles, cancel } = useExploreTransition(
    setMode,
    figures.shownVector,
  );

  // A fresh sphere shows the state it was opened for.
  useEffect(() => {
    cancel();
    setMode({ kind: "circuit" });
  }, [target, cancel]);

  const selectedStep =
    mode.kind === "step"
      ? mode.index
      : mode.kind === "circuit"
        ? currentStep
        : undefined;
  /** @param {number} index */
  const selectStep = (index) => {
    cancel();
    setMode(index === currentStep ? { kind: "circuit" } : { kind: "step", index });
  };
  const close = () => {
    appStore.setState({ blochTarget: undefined });
    closePanel("bloch");
    // Back to the circuit the sphere was clicked in, rather than nowhere.
    document.getElementById("canvasDiv")?.focus({ preventScroll: true });
  };

  const circuit = completed?.fullStats.circuitDefinition;
  const subtitle = subtitleFor(mode, target, {
    registers: circuit?.registers,
    playheadStep: completed?.step,
    columnCount: circuit?.columns.length,
  });

  // Opening the analyzer for a sphere brings the keyboard to it, where the eyes already are. The
  // dock may still be placing the panel, so focus is tried again for a few frames until it holds.
  const titleRef = useRef(/** @type {HTMLHeadingElement | null} */ (null));
  useEffect(() => {
    if (target === undefined) return undefined;
    let frame;
    let tries = 0;
    const focusTitle = () => {
      const title = titleRef.current;
      title?.focus({ preventScroll: true });
      if (document.activeElement !== title && tries++ < 20) frame = requestAnimationFrame(focusTitle);
    };
    focusTitle();
    return () => cancelAnimationFrame(frame);
  }, [target]);

  // Said once the state has settled: a dragged slider or a running circuit is not read out
  // value by value.
  const summary = stateSummary(subtitle, figures.readout);
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    const settle = setTimeout(() => setAnnounced(summary), SUMMARY_SETTLE_MS);
    return () => clearTimeout(settle);
  }, [summary]);

  return (
    <div
      className="panel-body bloch-panel"
      role="region"
      aria-labelledby="bloch-title"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          close();
        }
      }}
    >
      <AnalyzerHeader subtitle={subtitle} titleRef={titleRef} />
      <p className="visually-hidden" aria-live="polite">
        {announced}
      </p>

      {/* What changes the state, the numbers it changes and the pictures of it: the numbers stand
          beside the controls, so a slider and the values it moves are seen together. */}
      <div className="bloch-analyzer">
        <AnalyzerGroup
          className="bloch-area-source"
          title="State source"
          purpose="a step of the circuit, or a free state"
        >
          <div className="bloch-source-controls">
            <StepStrip
              steps={steps}
              selected={selectedStep}
              canvasRef={figures.stripRef}
              onSelect={selectStep}
            />
            <div className="bloch-explore-controls">
              <ExploreControls
                activePreset={mode.kind === "explore" ? mode.preset : undefined}
                canReturn={mode.kind !== "circuit" && target !== undefined}
                onPreset={(preset) =>
                  explore(preset.vec, { preset: preset.name, glide: true })
                }
                onReturn={() => {
                  cancel();
                  setMode({ kind: "circuit" });
                }}
                angles={anglesOf(figures.readout)}
                onAngles={exploreAngles}
              />
            </div>
          </div>
        </AnalyzerGroup>

        <ReadoutSidebar className="bloch-area-readout" readout={figures.readout} />

        <AnalyzerGroup
          className="bloch-area-figures"
          title="Figures"
          purpose="the qubit drawn three ways"
        >
          <BlochFigures
            sphereRef={figures.sphereRef}
            meridianRef={figures.meridianRef}
            equatorRef={figures.equatorRef}
            readout={figures.readout}
            rotated={figures.rotated}
            onResetView={figures.resetView}
            onPointerDown={figures.onPointerDown}
            onPointerMove={figures.onPointerMove}
            onKeyDown={figures.onKeyDown}
          />
          {/* What the figures draw, under the figures it changes. */}
          <div className="bloch-display" role="group" aria-label="What the figures draw">
            <AxisKey
              pinnedAxis={pinnedAxis}
              onTogglePin={(axis) =>
                setPinnedAxis((pinned) => (pinned === axis ? undefined : axis))
              }
              onPreview={setHoverAxis}
            />
            <LayerSwitches
              layers={layers}
              onChange={(key, checked) =>
                setLayers((current) => ({ ...current, [key]: checked }))
              }
            />
          </div>
        </AnalyzerGroup>
      </div>

      <AnalyzerFooter onClose={close} />
    </div>
  );
}

/** How long the state must hold still before the summary is read out. */
const SUMMARY_SETTLE_MS = 700;

/**
 * One sentence for assistive technology: whose state, and where its arrow points.
 * @param {string} subtitle
 * @param {import("./analyzerModel.js").PanelReadout | null | undefined} readout
 * @returns {string}
 */
function stateSummary(subtitle, readout) {
  if (readout === null || readout === undefined) return `${subtitle}: no state to show.`;
  const mixed = Number(readout.length) < PURE_STATE_THRESHOLD;
  return `${subtitle}: θ ${readout.theta}, ϕ ${readout.phi}, |r| ${readout.length}${mixed ? ", mixed" : ""}.`;
}

export { BlochPanel };
