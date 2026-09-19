import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_VIEW,
  drawBlochScene,
} from "../../../draw/displays/bloch/BlochScene.js";
import { drawBlochProjection } from "../../../draw/displays/bloch/BlochProjections.js";
import { drawBlochStrip } from "../../../draw/displays/bloch/BlochStrip.js";
import { clock } from "../../../base/Clock.js";
import { Animation } from "../../../config/Animation.js";
import { RenderSurface } from "../../../draw/surface/RenderSurface.js";
import { blochCoordinates, blochReading, blochVectorBetween } from "../../../engine/math/bloch.js";
import { appStore } from "../../../state/appStore.js";
import { closePanel } from "../../dock.jsx";
import {
  densityMatrixOf,
  glidesBetween,
  panelReadout,
} from "./analyzerModel.js";

/**
 * @typedef {object} BlochFiguresInputs
 * @property {Object | undefined} deps The panel dependencies: the completed simulation and the
 *     displayed circuit.
 * @property {Object | undefined} completed The completed simulation as panels sample it
 *     (useCompletedResult); each new sample repaints the figures.
 * @property {import("./analyzerModel.js").BlochTarget | undefined} target
 * @property {import("./analyzerModel.js").ViewMode} mode
 * @property {import("./analyzerModel.js").Layers} layers
 * @property {string | undefined} focusAxis
 * @property {import("./analyzerModel.js").Step[]} steps
 * @property {number | undefined} currentStep
 */

/**
 * The analyzer's four canvases - sphere, meridian, equator, steps - kept drawn: after a simulation
 * sample, a resize, a switch, a held axis, a chosen step or an explored state, and while the sphere
 * is dragged round. The canvases stay imperative, their painters drawing into them, so React only
 * holds their refs. What the painters show comes back as the readout.
 *
 * A time-dependent circuit completes a simulation every frame, but the figures follow the sampled
 * result every panel reads (useCompletedResult): four figures redrawn each frame held the whole app
 * to a fraction of its frame rate.
 *
 * Each canvas a painter draws into gets a render surface of its own - a WebGL context, and pointer
 * listeners on the whole document - which lives until it is released. The figures release theirs
 * when the panel closes and when a canvas is replaced. A browser keeps only a few contexts alive,
 * and past that it drops the oldest, which can be the circuit's own.
 *
 * When the state shown changes at once - another step, back from a free state, an edited circuit -
 * the arrow glides to it along the sphere over Animation.GLIDE_DURATION_MS, landing on the state as it is
 * then, so a running circuit's arrow is caught up with rather than left behind.
 *
 * Closes the panel when the sphere it was opened for has gone from the circuit.
 *
 * @param {BlochFiguresInputs} inputs
 */
function useBlochFigures({
  deps,
  completed,
  target,
  mode,
  layers,
  focusAxis,
  steps,
  currentStep,
}) {
  const sphereRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const meridianRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const equatorRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const stripRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const viewRef = useRef({ ...DEFAULT_VIEW });
  const shownVector = useRef(
    /** @type {import("./analyzerModel.js").BlochVector | undefined} */ (
      undefined
    ),
  );
  const modeRef = useRef(mode);
  const stepsRef = useRef(steps);
  const completedRef = useRef(completed);
  const optionsRef = useRef({ layers, focusAxis });
  const sourceRef = useRef(
    /** @type {import("./analyzerModel.js").ShownSource | undefined} */ (undefined),
  );
  const glideRef = useRef(
    /** @type {{ from: import("./analyzerModel.js").BlochVector, start: number } | undefined} */ (
      undefined
    ),
  );
  const glideFrame = useRef(/** @type {(() => void) | undefined} */ (undefined));
  const repaintRef = useRef(() => {});
  // Every canvas painted into, so its surface can be released once it is gone.
  const paintedCanvases = useRef(/** @type {Set<HTMLCanvasElement>} */ (new Set()));
  const [readout, setReadout] = useState(
    /** @type {import("./analyzerModel.js").PanelReadout | null | undefined} */ (
      undefined
    ),
  );

  // A fresh sphere is shown from the default view.
  useEffect(() => {
    viewRef.current = { ...DEFAULT_VIEW };
  }, [target]);

  const repaint = useMemo(() => {
    return () => {
      const canvas = sphereRef.current;
      if (canvas === null || deps === undefined) return;
      const shown = modeRef.current;
      let vec;
      if (shown.kind === "explore") {
        vec = shown.vec;
      } else {
        if (target === undefined) return;
        // The arrow comes from the sample the steps come from, so a time-dependent gate shows both
        // at one phase. A sample can trail an edit; only the simulator's newest result says the
        // sphere has gone.
        const densityMatrix = densityMatrixOf(deps, completedRef.current, target);
        if (densityMatrix === undefined) {
          if (densityMatrixOf(deps, deps.completed.getState().value, target) === undefined) {
            appStore.setState({ blochTarget: undefined });
            closePanel("bloch");
          }
          return;
        }
        vec =
          shown.kind === "step"
            ? stepsRef.current[shown.index]?.vec
            : densityMatrix.hasNaN()
              ? undefined
              : blochCoordinates(densityMatrix);
      }

      const source = {
        target,
        kind: shown.kind,
        index: shown.kind === "step" ? shown.index : undefined,
        circuit: completedRef.current?.circuit,
      };
      if (glidesBetween(sourceRef.current, source) && shownVector.current !== undefined && vec !== undefined) {
        glideRef.current = { from: shownVector.current, start: clock.now() };
      }
      sourceRef.current = source;
      const glide = glideRef.current;
      const progress = glide === undefined ? 1 : Math.min(1, (clock.now() - glide.start) / Animation.GLIDE_DURATION_MS);
      if (glide !== undefined && vec !== undefined && progress < 1) {
        vec = blochVectorBetween(glide.from, vec, Animation.GLIDE_EASING(progress));
        if (glideFrame.current === undefined) {
          glideFrame.current = clock.after(0, () => {
            glideFrame.current = undefined;
            repaintRef.current();
          });
        }
      } else {
        glideRef.current = undefined;
      }
      shownVector.current = vec;
      const { yaw, pitch } = viewRef.current;
      const reading = vec === undefined ? undefined : blochReading(vec);
      const options = { ...optionsRef.current, reading };
      // A canvas React replaced - the strip's, when the steps come and go - takes its surface along.
      const canvases = [canvas, meridianRef.current, equatorRef.current, stripRef.current];
      for (const painted of paintedCanvases.current) {
        if (!canvases.includes(painted)) {
          paintedCanvases.current.delete(painted);
          void RenderSurface.release(painted);
        }
      }
      for (const current of canvases) {
        if (current !== null) paintedCanvases.current.add(current);
      }
      drawBlochScene(canvas, vec, yaw, pitch, options);
      if (meridianRef.current !== null) {
        drawBlochProjection(meridianRef.current, vec, "meridian", options);
      }
      if (equatorRef.current !== null) {
        drawBlochProjection(equatorRef.current, vec, "equator", options);
      }
      if (stripRef.current !== null) {
        const selected =
          shown.kind === "step"
            ? shown.index
            : shown.kind === "circuit"
              ? currentStep
              : undefined;
        drawBlochStrip(
          stripRef.current,
          stepsRef.current.map((step) => step.vec),
          { selected, yaw, pitch },
        );
      }
      setReadout(vec === undefined ? null : panelReadout(vec, reading));
    };
  }, [deps, target, currentStep]);
  repaintRef.current = repaint;

  // A glide still under way stops with the panel, and the figures' surfaces go with it.
  useEffect(() => {
    const painted = paintedCanvases.current;
    return () => {
      glideFrame.current?.();
      for (const canvas of painted) void RenderSurface.release(canvas);
      painted.clear();
    };
  }, []);

  // A new simulation sample, a switch, a held axis, a chosen step or an explored state redraws the
  // same figures.
  useEffect(() => {
    optionsRef.current = { layers, focusAxis };
    modeRef.current = mode;
    stepsRef.current = steps;
    completedRef.current = completed;
    repaint();
  }, [completed, layers, focusAxis, mode, steps, repaint]);

  // The panel can be resized without a new sample, and that means repaint too.
  useEffect(() => {
    if (deps === undefined) {
      return undefined;
    }
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => repaint());
    for (const element of [
      sphereRef.current,
      meridianRef.current,
      equatorRef.current,
      stripRef.current,
    ]) {
      if (observer !== undefined && element !== null) observer.observe(element);
    }
    return () => observer?.disconnect();
  }, [deps, repaint]);

  // Drag rotates the view; pointer events so touch drags work the same way.
  /** @param {import("react").PointerEvent<HTMLCanvasElement>} event */
  const onPointerDown = (event) => {
    if (
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  /** @param {import("react").PointerEvent<HTMLCanvasElement>} event */
  const onPointerMove = (event) => {
    const canvas = event.currentTarget;
    if (!canvas.hasPointerCapture(event.pointerId)) {
      return;
    }
    const cssSize = Math.max(1, canvas.clientWidth);
    const view = viewRef.current;
    view.yaw -= (event.movementX * Math.PI) / cssSize;
    view.pitch = Math.max(
      Math.PI * -0.49,
      Math.min(
        Math.PI * 0.49,
        view.pitch + (event.movementY * Math.PI) / cssSize,
      ),
    );
    repaint();
  };

  return {
    sphereRef,
    meridianRef,
    equatorRef,
    stripRef,
    readout,
    shownVector,
    onPointerDown,
    onPointerMove,
  };
}

export { useBlochFigures };
