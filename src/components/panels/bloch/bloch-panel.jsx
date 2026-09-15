import { useEffect, useState } from "react";
import { useStore } from "zustand";

import { appStore } from "../../../state/appStore.js";
import { closePanel } from "../../dock.jsx";
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
 * The Bloch Sphere Analyzer: one qubit read three ways - the sphere in perspective, the meridian
 * that holds θ and the equator that holds ϕ, all face on - with every number beside them.
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

  const { steps, currentStep } = useCircuitSteps(target);
  const figures = useBlochFigures({
    deps,
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
  };

  return (
    <div className="panel-body bloch-panel" aria-labelledby="bloch-title">
      <AnalyzerHeader subtitle={subtitleFor(mode, target)} />

      <div className="bloch-analyzer">
        <div className="bloch-main">
          <AnalyzerGroup
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

          <AnalyzerGroup title="Figures" purpose="the qubit drawn three ways">
            <BlochFigures
              sphereRef={figures.sphereRef}
              meridianRef={figures.meridianRef}
              equatorRef={figures.equatorRef}
              onPointerDown={figures.onPointerDown}
              onPointerMove={figures.onPointerMove}
            />
          </AnalyzerGroup>

          <AnalyzerGroup title="Display" purpose="what the figures draw">
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
          </AnalyzerGroup>
        </div>

        <ReadoutSidebar readout={figures.readout} />
      </div>

      <AnalyzerFooter onClose={close} />
    </div>
  );
}

export { BlochPanel };
