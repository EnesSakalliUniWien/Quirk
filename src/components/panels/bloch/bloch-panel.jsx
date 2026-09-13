import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import { drawBlochScene } from "../../../draw/pixi/displays/BlochScene.js";
import { blochAngles, blochCoordinates, pureStateText } from "../../../engine/math/bloch.js";
import { appStore } from "../../../state/appStore.js";
import { closePanel } from "../../dock.jsx";

// The default view: yawed and tilted so all three axes are visibly distinct.
const DEFAULT_YAW = Math.PI * -0.15;
const DEFAULT_PITCH = Math.PI * 0.11;
/** Above this length the state is pure enough to name as a ket. */
const PURE_STATE_THRESHOLD = 0.999;

/** @param {!number} v @returns {!string} */
const sign = (v) => (v >= 0 ? "+" : "-") + Math.abs(v).toFixed(3);
/** @param {!number} v @returns {!string} */
const degrees = (v) => ((v * 180) / Math.PI).toFixed(1) + "°";

/**
 * The single-qubit state the panel was opened for, or undefined if that sphere has gone: an undo
 * or a URL change can remove it underneath the panel, and showing some other slot's state would be
 * worse than closing.
 *
 * @param {!Object} deps
 * @param {!{row: !int, col: (undefined|!int)}} target
 * @returns {undefined|!Matrix}
 */
function densityMatrixOf(deps, target) {
  const result = deps.completed.get();
  if (result === undefined) return undefined;
  const circuitDefinition = result.circuit;
  const stats = result.fullStats;
  if (target.col !== undefined) {
    const gate = circuitDefinition.gateInSlot(target.col, target.row);
    if (gate === undefined || gate.serializedId !== "Bloch") {
      return undefined;
    }
    return stats.qubitDensityMatrix(target.col, target.row);
  }
  if (target.row >= deps.displayed.get().displayedCircuit.importantWireCount()) {
    return undefined;
  }
  return stats.qubitDensityMatrix(Infinity, target.row);
}

/**
 * The enlarged Bloch sphere: the same single-qubit state the circuit paints in miniature, at a
 * size where the geometry is readable, rotatable by dragging, and printed as numbers.
 *
 * The sphere itself stays imperative - it is the circuit's own painter drawing into a canvas - so
 * the canvas is a ref and React never owns its pixels.
 */
function BlochPanel() {
  const deps = useStore(appStore, (s) => s.panelDeps);
  const target = useStore(appStore, (s) => s.blochTarget);
  const canvasRef = useRef(null);
  const viewRef = useRef({ yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH });
  const [readout, setReadout] = useState(undefined);

  // A fresh sphere gets the default view back.
  useEffect(() => {
    viewRef.current = { yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH };
  }, [target]);

  const repaint = useMemo(() => {
    return () => {
      const canvas = canvasRef.current;
      if (canvas === null || deps === undefined || target === undefined) {
        return;
      }
      const densityMatrix = densityMatrixOf(deps, target);
      if (densityMatrix === undefined) {
        appStore.setState({ blochTarget: undefined });
        closePanel("bloch");
        return;
      }
      const { yaw, pitch } = viewRef.current;
      if (densityMatrix.hasNaN()) {
        drawBlochScene(canvas, undefined, yaw, pitch);
        setReadout(null);
        return;
      }
      const vec = blochCoordinates(densityMatrix);
      const { r, theta, phi } = blochAngles(vec);
      drawBlochScene(canvas, vec, yaw, pitch);
      setReadout({
        state:
          r > PURE_STATE_THRESHOLD
            ? pureStateText(theta, phi)
            : "mixed — |r| < 1 (entangled or decohered)",
        x: sign(vec.x),
        y: sign(vec.y),
        z: sign(vec.z),
        theta: degrees(theta),
        phi: degrees(phi),
        purity: r.toFixed(3),
      });
    };
  }, [deps, target]);

  // Simulation frames keep arriving while a time-dependent circuit animates, and the panel can be
  // resized without a stats tick; both mean repaint.
  useEffect(() => {
    if (deps === undefined) {
      return undefined;
    }
    repaint();
    const unsubscribe = deps.completed.observable().subscribe(repaint);
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => repaint());
    if (observer !== undefined && canvasRef.current !== null) {
      observer.observe(canvasRef.current);
    }
    return () => {
      unsubscribe();
      observer?.disconnect();
    };
  }, [deps, repaint]);

  // Drag rotates the view; pointer events so touch drags work the same way.
  const onPointerDown = (event) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
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
      Math.min(Math.PI * 0.49, view.pitch + (event.movementY * Math.PI) / cssSize),
    );
    repaint();
  };

  const na = readout === null || readout === undefined;
  const value = (field) => (na ? "n/a" : readout[field]);

  return (
    <>
      <div className="panel-body bloch-panel" aria-labelledby="bloch-title">
        <header className="panel-header">
          <h2 id="bloch-title" className="bloch-title">
            Bloch sphere
          </h2>
        </header>
        <p id="bloch-subtitle" className="bloch-subtitle">
          {target === undefined
            ? "Click a Bloch sphere in the circuit."
            : `Qubit ${target.row + 1} · ` +
              (target.col === undefined
                ? "final output state"
                : `at column ${target.col + 1}`)}
        </p>
        <canvas
          id="bloch-canvas"
          ref={canvasRef}
          className="bloch-canvas"
          width="320"
          height="320"
          aria-label="Enlarged Bloch sphere view"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        />
        <p className="bloch-hint">Drag the sphere to rotate the view.</p>
        <dl className="bloch-readout">
          <dt>|ψ⟩</dt>
          <dd id="bloch-state">{value("state")}</dd>
          <dt>x</dt>
          <dd id="bloch-x">{value("x")}</dd>
          <dt>y</dt>
          <dd id="bloch-y">{value("y")}</dd>
          <dt>z</dt>
          <dd id="bloch-z">{value("z")}</dd>
          <dt>θ</dt>
          <dd id="bloch-theta">{value("theta")}</dd>
          <dt>ϕ</dt>
          <dd id="bloch-phi">{value("phi")}</dd>
          <dt>|r|</dt>
          <dd id="bloch-purity">{value("purity")}</dd>
        </dl>
        <div className="panel-action-row bloch-actions">
          <button
            id="bloch-close-button"
            type="button"
            onClick={() => {
              appStore.setState({ blochTarget: undefined });
              closePanel("bloch");
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

export { BlochPanel };
