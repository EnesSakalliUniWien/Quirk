import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import { CanvasTheme } from "../../config/CanvasTheme.js";
import { GateBuilder } from "../../circuit/model/Gate.js";
import { MathPainter } from "../../draw/MathPainter.js";
import { Point } from "../../geometry/Point.js";
import { Rect } from "../../geometry/Rect.js";
import { RenderSurface } from "../../draw/pixi/RenderSurface.js";
import { Serializer, fromJsonText_CircuitDefinition } from "../../serialization/Serializer.js";
import { drawCircuitTooltip } from "../../editor/DisplayedCircuit.js";
import { drawingArea } from "../../draw/pixi/DisplayView.js";
import { fitParagraph } from "../../draw/pixi/TextLayout.js";
import { rectangle, strokePath } from "../../draw/pixi/ShapeView.js";
import {
  parseUserGateFromCircuitRange,
  parseUserMatrix,
  parseUserRotation,
  randomCustomGateId,
} from "../../serialization/customGateParsing.js";
import { appStore } from "../../state/appStore.js";
import { closePanel } from "../dock.jsx";
import { useObservedValue } from "../useObservedValue.js";

/** Milliseconds. Typing must not recompute and repaint a preview on every keystroke. */
const PREVIEW_DEBOUNCE_MILLIS = 100;

/**
 * @param {!string} key The inputs, joined into one value. A string rather than the array itself:
 *     a fresh array every render would retrigger the timer forever.
 * @param {!number} millis
 * @returns {!string} The key, but no more often than once per `millis`.
 */
function useDebounced(key, millis) {
  const [settled, setSettled] = useState(key);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(key), millis);
    return () => clearTimeout(timer);
  }, [key, millis]);
  return settled;
}

/** Joins a method's inputs into one debounce key. */
const inputKey = (...values) => values.join(" ");

/** An empty field means its placeholder, the way the forge has always read them. */
const entered = (text, placeholder) => (text === "" ? placeholder : text);

/**
 * Paints an operation beside its Bloch rotation, and reports whether it is something a gate can
 * be built from. The drawing is the circuit's own painter, so it stays imperative.
 *
 * @param {!HTMLCanvasElement} canvas
 * @param {!function(): !Matrix} parseOp
 * @returns {!boolean} Whether the operation parsed and is free of NaN.
 */
function paintOperation(canvas, parseOp) {
  const painter = RenderSurface.forCanvas(canvas).beginFrame();
  rectangle(painter, drawingArea(painter), { fill: CanvasTheme.surface.gate });
  const d = Math.min((canvas.width - 5) / 2, canvas.height);
  const rect1 = new Rect(0, 0, d, d);
  const rect2 = new Rect(d + 5, 0, d, d);
  try {
    const op = parseOp();
    MathPainter.paintMatrix(
      painter,
      op,
      rect1,
      CanvasTheme.operation.fill,
      CanvasTheme.text.primary,
      undefined,
      CanvasTheme.operation.background,
      undefined,
      CanvasTheme.transparent,
    );
    if (!op.isUnitary(0.009)) {
      fitParagraph(painter, "NOT UNITARY", rect2, {
        alignment: new Point(0.5, 0.5),
        fill: CanvasTheme.error.text,
        maxFontSize: 24,
      });
    } else if (op.width() !== 2) {
      fitParagraph(painter, "(Not a 1-qubit rotation)", rect2, {
        alignment: new Point(0.5, 0.5),
        fill: CanvasTheme.text.muted,
        maxFontSize: 20,
      });
    } else {
      MathPainter.paintBlochSphereRotation(
        painter,
        op,
        rect2,
        CanvasTheme.operation.background,
        CanvasTheme.operation.fill,
      );
    }
    const cx = (rect1.right() + rect2.x) / 2;
    strokePath(
      painter,
      [new Point(cx, 0), new Point(cx, canvas.height)],
      CanvasTheme.text.primary,
      2,
    );
    return !op.hasNaN();
  } catch (ex) {
    fitParagraph(painter, ex + "", new Rect(0, 0, canvas.width, canvas.height), {
      alignment: new Point(0.5, 0.5),
      fill: CanvasTheme.error.text,
      maxFontSize: 24,
    });
    return false;
  }
}

/**
 * One matrix-based forge method: parse the inputs into an operation, preview it beside its Bloch
 * rotation, and on confirmation wrap it in a gate and commit it. The rotation and matrix sections
 * are both this skeleton; only their inputs, parsing, and gate dressing differ.
 *
 * @param {!{heading: !string, canvasId: !string, buttonId: !string, buttonLabel: !string,
 *     nameId: !string, namePlaceholder: !string, inputs: !string, parseOp: !function(): !Matrix,
 *     buildGate: !function(!Matrix, !string): !Gate, onCreate: !function(!Gate): void,
 *     children: *}} props
 */
function MatrixMethod({
  heading,
  canvasId,
  buttonId,
  buttonLabel,
  nameId,
  namePlaceholder,
  inputs,
  parseOp,
  buildGate,
  onCreate,
  children,
}) {
  const canvasRef = useRef(null);
  // Held in a ref so the paint effect can call the latest parser without depending on its identity.
  const parseOpRef = useRef(parseOp);
  parseOpRef.current = parseOp;
  const [name, setName] = useState("");
  const [buildable, setBuildable] = useState(false);
  const settled = useDebounced(inputs, PREVIEW_DEBOUNCE_MILLIS);

  // Repaints when the settled inputs change. parseOp closes over those inputs, so `settled` is
  // what makes it current; depending on parseOp itself would repaint on every render.
  useEffect(() => {
    if (canvasRef.current !== null) {
      setBuildable(paintOperation(canvasRef.current, parseOpRef.current));
    }
  }, [settled]);

  const create = () => {
    let matrix;
    try {
      matrix = parseOp();
    } catch (ex) {
      console.warn(ex);
      return; // The button is about to be disabled, so no handling required.
    }
    onCreate(buildGate(matrix, name));
  };

  return (
    <section className="forge-method">
      <h2>{heading}</h2>
      <div className="forge-fields">{children}</div>
      <canvas id={canvasId} ref={canvasRef} className="forge-preview" />
      <label className="forge-field" htmlFor={nameId}>
        <span>Circuit symbol</span>
        <input
          id={nameId}
          type="text"
          placeholder={namePlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button id={buttonId} type="button" disabled={!buildable} onClick={create}>
        {buttonLabel}
      </button>
    </section>
  );
}

/**
 * The third method, which takes a range of the circuit on screen rather than a matrix: it previews
 * the gate the range would become, reports what it needs and what it costs, and animates while a
 * time-dependent gate is inside it.
 *
 * @param {!{deps: !Object, circuitJson: !string, onCreate: !function(!Gate, !Object): void}} props
 */
function CircuitMethod({ deps, circuitJson, onCreate }) {
  const canvasRef = useRef(null);
  const [cols, setCols] = useState("");
  const [rows, setRows] = useState("");
  const [name, setName] = useState("");
  const [stats, setStats] = useState({ inputs: "(none)", weight: "0" });
  const [buildable, setBuildable] = useState(false);
  const settled = useDebounced(
    inputKey(cols, rows, name, circuitJson),
    PREVIEW_DEBOUNCE_MILLIS,
  );
  // Held in a ref for the same reason as the matrix methods': the preview follows the settled
  // inputs, not every keystroke's new closure.
  const parseRef = useRef(undefined);
  parseRef.current = () => {
    const circuit = fromJsonText_CircuitDefinition(circuitJson);
    const gate = parseUserGateFromCircuitRange(
      circuit,
      entered(cols, "1:∞"),
      entered(rows, "1:∞"),
      name.trim(),
    );
    return { gate, circuit };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return undefined;
    }
    const paint = (gate) => {
      const painter = RenderSurface.forCanvas(canvas).beginFrame();
      rectangle(painter, drawingArea(painter), { fill: CanvasTheme.surface.gate });
      drawCircuitTooltip(
        painter,
        gate.knownCircuitNested,
        new Rect(0, 0, canvas.width, canvas.height),
        true,
        deps.cycleTime(),
      );
    };

    let gate;
    try {
      gate = parseRef.current().gate;
      const keys = gate.getUnmetContextKeys();
      setStats({
        inputs:
          keys.size === 0
            ? "(none)"
            : [...keys]
                .map((e) =>
                  e.replace("Input Range ", "").replace("Input NO_DEFAULT Range ", ""),
                )
                .join(", "),
        weight: "" + gate.knownCircuit.gateWeight(),
      });
      setBuildable(true);
      paint(gate);
    } catch (ex) {
      setStats({ inputs: "(err)", weight: "(err)" });
      setBuildable(false);
      const painter = RenderSurface.forCanvas(canvas).beginFrame();
      rectangle(painter, drawingArea(painter), { fill: CanvasTheme.surface.gate });
      fitParagraph(painter, ex + "", new Rect(0, 0, canvas.width, canvas.height), {
        alignment: new Point(0.5, 0.5),
        fill: CanvasTheme.error.text,
        maxFontSize: 24,
      });
      return undefined;
    }

    // A gate that never changes needs one frame; one that does follows the circuit's own clock.
    if (gate.stableDuration() === Infinity) {
      return undefined;
    }
    let frame = requestAnimationFrame(function tick() {
      paint(gate);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [settled, deps]);

  return (
    <section className="forge-method">
      <h2>From Circuit</h2>
      <div className="forge-fields">
        <label className="forge-field" htmlFor="gate-forge-circuit-cols">
          <span>Column range</span>
          <input
            id="gate-forge-circuit-cols"
            type="text"
            placeholder="1:∞"
            value={cols}
            onChange={(event) => setCols(event.target.value)}
          />
        </label>
        <label className="forge-field" htmlFor="gate-forge-circuit-rows">
          <span>Wire range</span>
          <input
            id="gate-forge-circuit-rows"
            type="text"
            placeholder="1:∞"
            value={rows}
            onChange={(event) => setRows(event.target.value)}
          />
        </label>
      </div>
      <div className="forge-stats">
        Inputs: <span id="gate-forge-circuit-inputs">{stats.inputs}</span>
        <br />
        Weight: <span id="gate-forge-circuit-weight">{stats.weight}</span>
      </div>
      <canvas id="gate-forge-circuit-canvas" ref={canvasRef} className="forge-preview" />
      <label className="forge-field" htmlFor="gate-forge-circuit-name">
        <span>Circuit symbol</span>
        <input
          id="gate-forge-circuit-name"
          type="text"
          placeholder="[the circuit]"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button
        id="gate-forge-circuit-button"
        type="button"
        disabled={!buildable}
        onClick={() => {
          try {
            const { gate, circuit } = parseRef.current();
            onCreate(gate, circuit);
          } catch (ex) {
            // The button is about to be disabled, so no handling required.
            console.warn(ex);
          }
        }}
      >
        Create Circuit Gate
      </button>
    </section>
  );
}

/**
 * The gate forge: define a custom gate from a rotation, from a matrix, or from part of the circuit
 * already on screen.
 */
function ForgePanel() {
  const deps = useStore(appStore, (s) => s.panelDeps);
  return deps === undefined ? (
    null
  ) : (
    <ForgePanelBody deps={deps} />
  );
}

/**
 * @param {!{deps: !Object}} props
 */
function ForgePanelBody({ deps }) {
  const commits = useMemo(() => deps.revision.latestActiveCommit(), [deps]);
  const circuitJson = useObservedValue(commits) ?? "";
  const [axis, setAxis] = useState("");
  const [angle, setAngle] = useState("");
  const [phase, setPhase] = useState("");
  const [matrixText, setMatrixText] = useState("");
  const [ensureUnitary, setEnsureUnitary] = useState(true);

  const createGate = (gate, circuitDef = undefined) => {
    const circuit = circuitDef ?? fromJsonText_CircuitDefinition(circuitJson);
    deps.revision.commit(
      JSON.stringify(Serializer.toJson(circuit.withCustomGate(gate)), null, 0),
    );
    closePanel("forge");
  };

  return (
    <>
      <div className="panel-body forge-panel" aria-labelledby="forge-title">
        <header className="panel-header">
          <p className="panel-eyebrow">Custom operation</p>
          <h1 id="forge-title" className="panel-title">
            Make a gate
          </h1>
          <p className="panel-description">
            Define a gate from a rotation, a matrix, or part of the current circuit.
          </p>
        </header>
        <div className="forge-grid">
          <MatrixMethod
            heading="From Rotation"
            canvasId="gate-forge-rotation-canvas"
            buttonId="gate-forge-rotation-button"
            buttonLabel="Create Rotation Gate"
            nameId="gate-forge-rotation-name"
            namePlaceholder="[the matrix]"
            inputs={inputKey(axis, angle, phase)}
            parseOp={() =>
              parseUserRotation(
                entered(angle, "45"),
                entered(phase, "0"),
                entered(axis, "X+Z"),
              )
            }
            buildGate={(matrix, name) =>
              new GateBuilder()
                .setSerializedId(randomCustomGateId())
                .setSymbol(name)
                .setTitle("Custom Rotation Gate")
                .setKnownEffectToMatrix(matrix).gate
            }
            onCreate={createGate}
          >
            <label className="forge-field" htmlFor="gate-forge-rotation-axis">
              <span>Axis</span>
              <input
                id="gate-forge-rotation-axis"
                type="text"
                placeholder="X+Z"
                value={axis}
                onChange={(event) => setAxis(event.target.value)}
              />
            </label>
            <label className="forge-field" htmlFor="gate-forge-rotation-angle">
              <span>Angle (degrees)</span>
              <input
                id="gate-forge-rotation-angle"
                type="text"
                placeholder="45"
                value={angle}
                onChange={(event) => setAngle(event.target.value)}
              />
            </label>
            <label className="forge-field" htmlFor="gate-forge-rotation-phase">
              <span>Global phase (degrees)</span>
              <input
                id="gate-forge-rotation-phase"
                type="text"
                placeholder="0"
                value={phase}
                onChange={(event) => setPhase(event.target.value)}
              />
            </label>
          </MatrixMethod>

          <div className="forge-choice-divider" aria-hidden="true">
            or
          </div>

          <MatrixMethod
            heading="From Matrix"
            canvasId="gate-forge-matrix-canvas"
            buttonId="gate-forge-matrix-button"
            buttonLabel="Create Matrix Gate"
            nameId="gate-forge-matrix-name"
            namePlaceholder="[the matrix]"
            inputs={inputKey(matrixText, ensureUnitary)}
            parseOp={() =>
              parseUserMatrix(entered(matrixText, "1, i,  i, 1"), ensureUnitary)
            }
            buildGate={(matrix, rawName) => {
              const name = rawName.trim();
              const h = Math.round(Math.log2(matrix.height()));
              return new GateBuilder()
                .setSerializedId(randomCustomGateId())
                .setSymbol(name)
                .setTitle("Custom Matrix Gate")
                .setHeight(h)
                .setWidth(name === "" ? h : 1)
                .setKnownEffectToMatrix(matrix).gate;
            }}
            onCreate={createGate}
          >
            <label className="forge-field" htmlFor="gate-forge-matrix">
              <span>Matrix values</span>
              <textarea
                id="gate-forge-matrix"
                placeholder="1, i,  i, 1"
                value={matrixText}
                onChange={(event) => setMatrixText(event.target.value)}
              />
            </label>
            <label className="checkbox-row" htmlFor="gate-forge-matrix-fix">
              <input
                id="gate-forge-matrix-fix"
                type="checkbox"
                checked={ensureUnitary}
                onChange={(event) => setEnsureUnitary(event.target.checked)}
              />
              <span className="matrix-fix-label">Ensure unitary (by SVD)</span>
            </label>
          </MatrixMethod>

          <div className="forge-choice-divider" aria-hidden="true">
            or
          </div>

          <CircuitMethod deps={deps} circuitJson={circuitJson} onCreate={createGate} />
        </div>
      </div>
    </>
  );
}

export { ForgePanel };
