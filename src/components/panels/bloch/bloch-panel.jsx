import {observeStore} from '../../../base/valueStore.js';
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import { drawBlochScene } from "../../../draw/displays/BlochScene.js";
import { drawBlochSections } from "../../../draw/displays/BlochSections.js";
import {
  blochAngles,
  blochCoordinates,
  blochQuaternion,
  pureQuaternionText,
  pureStateText,
  quaternionText,
  signed,
} from "../../../engine/math/bloch.js";
import { appStore } from "../../../state/appStore.js";
import { closePanel } from "../../dock.jsx";

// The default view: yawed and tilted so all three axes are visibly distinct.
const DEFAULT_YAW = Math.PI * -0.15;
const DEFAULT_PITCH = Math.PI * 0.11;
/** Above this length the state is pure enough to name as a ket. */
const PURE_STATE_THRESHOLD = 0.999;

/**
 * What a fresh reading draws: the components against the coloured frame. The constructions that
 * answer a narrower question - the planes, and the turn the quaternion names - are switched on when
 * they are the question, because all of them at once is a thicket rather than a diagnosis.
 */
const INITIAL_LAYERS = {circles: true, components: true, planes: false, angles: true, quaternion: false,
  sections: true, trig: true};
const LAYERS = [
  ["components", "Components"],
  ["planes", "Planes"],
  ["angles", "Angles θ ϕ"],
  ["quaternion", "Quaternion"],
  ["circles", "Unit circles"],
  ["sections", "Sections"],
  ["trig", "cos · sin"],
];
const AXES = [
  ["x", "|+⟩ |−⟩"],
  ["y", "|+i⟩ |−i⟩"],
  ["z", "|0⟩ |1⟩"],
];

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
  const result = deps.completed.getState().value;
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
  if (target.row >= deps.displayed.getState().value.displayedCircuit.importantWireCount()) {
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
  const sectionsRef = useRef(null);
  const viewRef = useRef({ yaw: DEFAULT_YAW, pitch: DEFAULT_PITCH });
  const [readout, setReadout] = useState(undefined);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  // Hovering an axis previews it; clicking keeps it, so a reading can be held while the sphere
  // is dragged with the other hand.
  const [pinnedAxis, setPinnedAxis] = useState(undefined);
  const [hoverAxis, setHoverAxis] = useState(undefined);
  const focusAxis = hoverAxis ?? pinnedAxis;
  const optionsRef = useRef({ layers: INITIAL_LAYERS, focusAxis: undefined });

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
      const sections = sectionsRef.current;
      if (densityMatrix.hasNaN()) {
        drawBlochScene(canvas, undefined, yaw, pitch, optionsRef.current);
        if (sections !== null) drawBlochSections(sections, undefined, optionsRef.current);
        setReadout(null);
        return;
      }
      const vec = blochCoordinates(densityMatrix);
      const { r, theta, phi } = blochAngles(vec);
      drawBlochScene(canvas, vec, yaw, pitch, optionsRef.current);
      if (sections !== null) drawBlochSections(sections, vec, optionsRef.current);
      setReadout({
        state:
          r > PURE_STATE_THRESHOLD
            ? pureStateText(theta, phi)
            : "mixed — |r| < 1 (entangled or decohered)",
        x: signed(vec.x),
        y: signed(vec.y),
        z: signed(vec.z),
        theta: degrees(theta),
        phi: degrees(phi),
        purity: r.toFixed(3),
        quaternion: quaternionText(blochQuaternion(theta, phi)),
        vector: pureQuaternionText(vec),
      });
    };
  }, [deps, target]);

  // A switch or a held axis redraws the same frame with different weights.
  useEffect(() => {
    optionsRef.current = { layers, focusAxis };
    repaint();
  }, [layers, focusAxis, repaint]);

  // Simulation frames keep arriving while a time-dependent circuit animates, and the panel can be
  // resized without a stats tick; both mean repaint.
  useEffect(() => {
    if (deps === undefined) {
      return undefined;
    }
    repaint();
    const unsubscribe = observeStore(deps.completed).subscribe(repaint);
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => repaint());
    for (const element of [canvasRef.current, sectionsRef.current]) {
      if (observer !== undefined && element !== null) observer.observe(element);
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
    <div className="panel-body bloch-panel" aria-labelledby="bloch-title">
      <header className="panel-header">
        <h2 id="bloch-title" className="bloch-title">
          Bloch sphere
        </h2>
        <p id="bloch-subtitle" className="bloch-subtitle">
          {target === undefined
            ? "Click a Bloch sphere in the circuit."
            : `Qubit ${target.row + 1} · ` +
              (target.col === undefined ? "final output state" : `at column ${target.col + 1}`)}
        </p>
      </header>

      <div className="bloch-layout">
        {/* The canvas gets a wrapper, so what the layout sizes is the track and the canvas itself
            stays square: the painter draws a square of its clientWidth. */}
        <div className="bloch-stage">
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
        </div>

        <div className="bloch-analysis">
          <p className="bloch-hint">
            Drag to rotate. Each axis owns a unit circle, a colour and a solid leg as long as its
            component; hover an axis to read it alone, click to keep it.
          </p>

          <ul className="bloch-legend" aria-label="Axis colours">
            {AXES.map(([axis, kets]) => (
              <li key={axis}>
                <button
                  type="button"
                  id={`bloch-axis-${axis}-button`}
                  className={`bloch-legend-axis bloch-axis-${axis}`}
                  aria-pressed={pinnedAxis === axis}
                  title={`Read the ${axis} axis on its own`}
                  onClick={() => setPinnedAxis((pinned) => (pinned === axis ? undefined : axis))}
                  onPointerEnter={() => setHoverAxis(axis)}
                  onPointerLeave={() => setHoverAxis(undefined)}
                  onFocus={() => setHoverAxis(axis)}
                  onBlur={() => setHoverAxis(undefined)}
                >
                  <span className="bloch-swatch" aria-hidden="true" />
                  {axis}
                </button>
                <span className="bloch-legend-kets">{kets}</span>
              </li>
            ))}
          </ul>

          <div className="bloch-layers" role="group" aria-label="Constructions to draw">
            {LAYERS.map(([key, label]) => (
              <label key={key} className="bloch-layer">
                <input
                  type="checkbox"
                  id={`bloch-layer-${key}`}
                  checked={layers[key]}
                  onChange={(event) =>
                    setLayers((current) => ({ ...current, [key]: event.target.checked }))
                  }
                />
                {label}
              </label>
            ))}
          </div>

          <dl className="bloch-readout">
            <div className="bloch-row">
              <dt>|ψ⟩</dt>
              <dd id="bloch-state">{value("state")}</dd>
            </div>
            <div className="bloch-row bloch-group-start">
              <dt className="bloch-axis-x">x</dt>
              <dd id="bloch-x">{value("x")}</dd>
            </div>
            <div className="bloch-row">
              <dt className="bloch-axis-y">y</dt>
              <dd id="bloch-y">{value("y")}</dd>
            </div>
            <div className="bloch-row">
              <dt className="bloch-axis-z">z</dt>
              <dd id="bloch-z">{value("z")}</dd>
            </div>
            <div className="bloch-row bloch-group-start">
              <dt>θ</dt>
              <dd id="bloch-theta">{value("theta")}</dd>
            </div>
            <div className="bloch-row">
              <dt>ϕ</dt>
              <dd id="bloch-phi">{value("phi")}</dd>
            </div>
            <div className="bloch-row">
              <dt>|r|</dt>
              <dd id="bloch-purity">{value("purity")}</dd>
            </div>
            <div className="bloch-row bloch-group-start">
              <dt>q</dt>
              <dd id="bloch-quaternion" className="bloch-quaternion-value">
                {value("quaternion")}
              </dd>
            </div>
            <div className="bloch-row">
              <dt>r</dt>
              <dd id="bloch-vector-quaternion" className="bloch-quaternion-value">
                {value("vector")}
              </dd>
            </div>
          </dl>

          <p className="bloch-hint">
            q = cos(θ/2) + sin(θ/2)(−sin ϕ i + cos ϕ j) turns |0⟩ onto the state, about the axis n
            in the equator and through the angle θ; r = |r| q k q̄. Switch the quaternion on to see
            n and that turn drawn on the sphere.
          </p>
        </div>
      </div>

      {/* Underneath the sphere, the same state read face-on: no perspective to allow for. */}
      <div className="bloch-sections" hidden={!layers.sections}>
        <p className="bloch-hint">
          Looking down each axis: the shadow the vector casts in the plane normal to it.
        </p>
        <canvas
          id="bloch-sections-canvas"
          ref={sectionsRef}
          className="bloch-sections-canvas"
          aria-label="Sections along each axis"
        />
      </div>

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
  );
}

export { BlochPanel };
