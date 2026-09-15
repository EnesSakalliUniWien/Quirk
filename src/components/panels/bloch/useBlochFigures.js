import { useEffect, useMemo, useRef, useState } from "react";

import { observeStore } from "../../../base/valueStore.js";
import {
  DEFAULT_VIEW,
  drawBlochScene,
} from "../../../draw/displays/BlochScene.js";
import { drawBlochProjection } from "../../../draw/displays/BlochProjections.js";
import { drawBlochStrip } from "../../../draw/displays/BlochStrip.js";
import { blochCoordinates } from "../../../engine/math/bloch.js";
import { appStore } from "../../../state/appStore.js";
import { closePanel } from "../../dock.jsx";
import { densityMatrixOf, panelReadout } from "./analyzerModel.js";

/**
 * @typedef {object} BlochFiguresInputs
 * @property {Object | undefined} deps The panel dependencies: the completed simulation and the
 *     displayed circuit.
 * @property {import("./analyzerModel.js").BlochTarget | undefined} target
 * @property {import("./analyzerModel.js").ViewMode} mode
 * @property {import("./analyzerModel.js").Layers} layers
 * @property {string | undefined} focusAxis
 * @property {import("./analyzerModel.js").Step[]} steps
 * @property {number | undefined} currentStep
 */

/**
 * The analyzer's four canvases - sphere, meridian, equator, steps - kept drawn: after a simulation
 * frame, a resize, a switch, a held axis, a chosen step or an explored state, and while the sphere
 * is dragged round. The canvases stay imperative, their painters drawing into them, so React only
 * holds their refs. What the painters show comes back as the readout.
 *
 * Closes the panel when the sphere it was opened for has gone from the circuit.
 *
 * @param {BlochFiguresInputs} inputs
 */
function useBlochFigures({
  deps,
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
  const optionsRef = useRef({ layers, focusAxis });
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
        const densityMatrix = densityMatrixOf(deps, target);
        if (densityMatrix === undefined) {
          appStore.setState({ blochTarget: undefined });
          closePanel("bloch");
          return;
        }
        vec =
          shown.kind === "step"
            ? stepsRef.current[shown.index]?.vec
            : densityMatrix.hasNaN()
              ? undefined
              : blochCoordinates(densityMatrix);
      }
      shownVector.current = vec;
      const { yaw, pitch } = viewRef.current;
      const options = optionsRef.current;
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
      setReadout(vec === undefined ? null : panelReadout(vec));
    };
  }, [deps, target, currentStep]);

  // A switch, a held axis, a chosen step or an explored state redraws the same figures.
  useEffect(() => {
    optionsRef.current = { layers, focusAxis };
    modeRef.current = mode;
    stepsRef.current = steps;
    repaint();
  }, [layers, focusAxis, mode, steps, repaint]);

  // Simulation frames keep arriving while a time-dependent circuit animates, and the panel can be
  // resized without a stats tick; both mean repaint.
  useEffect(() => {
    if (deps === undefined) {
      return undefined;
    }
    repaint();
    const unsubscribe = observeStore(deps.completed).subscribe(repaint);
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
    return () => {
      unsubscribe();
      observer?.disconnect();
    };
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
