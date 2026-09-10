import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";

import { Util } from "../../base/Util.js";
import { stateGrid } from "../../draw/renderers/dataRenderers.js";
import { Matrix } from "../../engine/math/matrix/Matrix.js";
import { circuitAlgebra } from "../../engine/simulation/stepAlgebra.js";
import { Serializer } from "../../serialization/Serializer.js";
import { appStore } from "../../state/appStore.js";
import { DataView } from "../math/data-view.jsx";
import { MatrixRow } from "../math/mathml.jsx";
import { operatorModel, stateModel } from "../math/matrixModel.js";
import { OperatorView } from "../math/operator-view.jsx";
import { useCircuitStats, usePlayheadStats } from "./usePlayheadStats.js";

/** Up to this many basis states the entries are written out; past it they are plotted. */
const SYMBOLIC_MAX_ROWS = 8;
/** The evolution chart is at most this tall; past it basis states share rows of pixels. */
const EVOLUTION_MAX_HEIGHT = 256;
/** A step's column width once rows share pixels, so a tall, thin chart stays readable. */
const EVOLUTION_PIXEL_COLUMN = 16;
/** An entry that moved less than this between steps did not change. */
const CHANGE_TOLERANCE = 1e-6;
/** How wide the ket labels beside the evolution chart are, in pixels; matches the stylesheet. */
const EVOLUTION_LABEL_WIDTH = 48;
/** The longest side of a drawn matrix or state in a step card, in pixels. */
const PLOT_SIZE = 180;

/**
 * The CSS size a drawn matrix takes when its longest side is PLOT_SIZE, keeping cells square.
 *
 * @param {!Matrix} matrix
 * @returns {!{width: !number, height: !number}}
 */
function plotSize(matrix) {
  const cell = PLOT_SIZE / Math.max(matrix.width(), matrix.height());
  return { width: matrix.width() * cell, height: matrix.height() * cell };
}

/**
 * Scrolls a horizontal scroller so the span [left, left + width) sits in its middle. Only that one
 * scroller moves: scrollIntoView would also scroll the dock and the page to reach it.
 *
 * @param {!HTMLElement} scroller
 * @param {!number} left
 * @param {!number} width
 */
function centreHorizontally(scroller, left, width) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scroller.scrollTo({
    left: Math.max(0, left - (scroller.clientWidth - width) / 2),
    behavior: reduceMotion ? "auto" : "smooth",
  });
}

/**
 * Lets a mouse wheel scroll a horizontal scroller sideways. Trackpads and shift+wheel already do;
 * a plain wheel over the track now does too, and at either end hands the wheel back to the panel
 * so it can still scroll up and down.
 *
 * @param {!{current: (null|!HTMLElement)}} ref
 * @param {!boolean=} mounted Whether the element exists yet. A panel that first renders a
 *     placeholder mounts its scroller later, and the listener has to follow it there.
 */
function useWheelScrollsSideways(ref, mounted = true) {
  useEffect(() => {
    const scroller = ref.current;
    if (scroller === null) {
      return undefined;
    }
    const onWheel = (event) => {
      if (event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
        return;
      }
      const max = scroller.scrollWidth - scroller.clientWidth;
      const atStart = scroller.scrollLeft <= 0;
      const atEnd = scroller.scrollLeft >= max - 1;
      if (max <= 0 || (event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) {
        return;
      }
      scroller.scrollLeft = Math.max(0, Math.min(max, scroller.scrollLeft + event.deltaY));
      event.preventDefault();
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [ref, mounted]);
}

/**
 * The whole circuit's algebra, recomputed only when something it depends on changed: an unchanged
 * circuit reuses the last answer outright, and a changed one still reuses every time-independent
 * column's matrix (see circuitAlgebra).
 *
 * @param {undefined|!CircuitStats} stats
 * @param {undefined|!int} wireCount
 * @returns {undefined|!CircuitAlgebra}
 */
function useCircuitAlgebra(stats, wireCount) {
  const cache = useRef(undefined);
  return useMemo(() => {
    if (stats === undefined || wireCount === undefined) {
      return undefined;
    }
    const last = cache.current;
    const circuit = stats.circuitDefinition;
    if (
      last !== undefined &&
      last.algebra.wireCount === wireCount &&
      last.circuit.isEqualTo(circuit) &&
      (circuit.stableDuration() === Infinity || last.time === stats.time)
    ) {
      return last.algebra;
    }
    const algebra = circuitAlgebra(stats, wireCount, last?.algebra);
    cache.current = { circuit, time: stats.time, algebra };
    return algebra;
  }, [stats, wireCount]);
}

/**
 * Every step's state at once, laid out like the circuit: a column per step, left to right, and a
 * row per basis state. It is drawn by the same state renderer as the circuit's amplitude display -
 * discs for magnitude, hands and hue for phase - so it reads the way the canvas does; past
 * EVOLUTION_MAX_HEIGHT rows the renderer switches to pixels, each row of them the largest of the
 * basis states it covers. Reading along a row shows one amplitude change step by step. The current
 * step is outlined and kept in view as the playhead moves.
 *
 * @param {!{states: !Array.<!Matrix>, wireCount: !int, current: !int}} props
 */
function EvolutionChart({ states, wireCount, current }) {
  const scrollerRef = useRef(null);
  useWheelScrollsSideways(scrollerRef);
  const size = 1 << wireCount;
  const cell = Math.max(6, Math.min(16, Math.floor(256 / size)));
  const height = Math.min(size * cell, EVOLUTION_MAX_HEIGHT);
  const column = size * cell > EVOLUTION_MAX_HEIGHT ? EVOLUTION_PIXEL_COLUMN : cell;
  const labelled = size <= 16;

  // Column k is the state after step k.
  const evolution = useMemo(() => {
    const steps = states.length;
    const buffer = new Float64Array(size * steps * 2);
    states.forEach((state, k) => {
      const source = state.rawBuffer();
      for (let i = 0; i < size; i++) {
        buffer[(i * steps + k) * 2] = source[i * 2];
        buffer[(i * steps + k) * 2 + 1] = source[i * 2 + 1];
      }
    });
    return new Matrix(steps, size, buffer);
  }, [states, size]);

  // The chart moves with the playhead, the way the step cards below it do.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller !== null) {
      centreHorizontally(scroller, (labelled ? EVOLUTION_LABEL_WIDTH : 0) + current * column, column);
    }
  }, [current, labelled, column]);

  return (
    <div className="algebra-evolution" ref={scrollerRef}>
      <div
        className={labelled ? "evolution-grid evolution-labelled" : "evolution-grid"}
        style={{ "--evolution-cell": `${column}px`, "--evolution-row": `${cell}px` }}
      >
        <ol className="evolution-steps" aria-hidden="true">
          {states.map((_, k) => (
            <li key={k}>{k}</li>
          ))}
        </ol>
        {labelled && (
          <ol className="evolution-kets" aria-hidden="true">
            {Array.from({ length: size }, (_, i) => (
              <li key={i}>{`|${Util.bin(i, wireCount)}⟩`}</li>
            ))}
          </ol>
        )}
        <div className="evolution-plot">
          <DataView
            kind="state"
            data={evolution}
            width={states.length * column}
            height={height}
            options={{ wireCount }}
            label={`How each of the ${size} amplitudes changes over ${states.length - 1} steps`}
          />
          <span
            className="evolution-current"
            aria-hidden="true"
            style={{ left: `${current * column}px`, width: `${column}px` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * One step as a card: what the column does, its matrix, and the state it leaves - with the entries
 * that step changed marked, so the cards read as a sequence of changes rather than of states.
 */
function StepCard({ index, step, before, after, wireCount, current, onSeek, source }) {
  const symbolic = (1 << wireCount) <= SYMBOLIC_MAX_ROWS;
  const grid = useMemo(() => stateGrid(after), [after]);
  const changed = (row) => {
    const a = before.rawBuffer();
    const b = after.rawBuffer();
    return Math.hypot(a[row * 2] - b[row * 2], a[row * 2 + 1] - b[row * 2 + 1]) > CHANGE_TOLERANCE;
  };
  const number = index + 1;
  return (
    <li className="algebra-step" data-step={number} aria-current={current ? "step" : undefined}>
      <button type="button" className="algebra-step-header" onClick={() => onSeek(number)}>
        <span className="algebra-step-number">{number}</span>
        <span className="algebra-step-description">{step.description}</span>
      </button>
      {step.matrix !== undefined && symbolic ? (
        // Two blocks rather than one equation, so a wide matrix pushes the result onto the next
        // line instead of past the card's edge.
        <div
          className="algebra-equation"
          role="group"
          aria-label={`Step ${number} as a matrix, times the state before it, gives the state after it`}
        >
          <math display="block" className="algebra-math">
            <MatrixRow model={operatorModel(step.matrix)} />
          </math>
          <math display="block" className="algebra-math">
            <mrow>
              <mo>·</mo>
              <msub>
                <mi>ψ</mi>
                <mn>{number - 1}</mn>
              </msub>
              <mo>=</mo>
              <MatrixRow model={stateModel(after)} highlight={(row) => changed(row)} />
            </mrow>
          </math>
        </div>
      ) : (
        <div className="algebra-plotted">
          {step.matrix !== undefined ? (
            <DataView
              kind="matrix"
              data={step.matrix}
              {...plotSize(step.matrix)}
              label={`Step ${number} as a matrix`}
            />
          ) : step.structure !== undefined ? (
            <OperatorView
              source={source}
              structure={step.structure}
              size={PLOT_SIZE}
              label={`Step ${number} as a matrix`}
            />
          ) : undefined}
          <math className="algebra-math" aria-hidden="true">
            {step.structure !== undefined ? (
              <mrow>
                <mo>·</mo>
                <msub>
                  <mi>ψ</mi>
                  <mn>{number - 1}</mn>
                </msub>
                <mo>=</mo>
              </mrow>
            ) : (
              <mo>→</mo>
            )}
          </math>
          {symbolic ? (
            <math display="block" className="algebra-math" aria-label={`The state after step ${number}`}>
              <MatrixRow model={stateModel(after)} highlight={(row) => changed(row)} />
            </math>
          ) : (
            <DataView
              kind="state"
              data={grid}
              {...plotSize(grid)}
              options={{ wireCount }}
              label={`The state after step ${number}`}
            />
          )}
        </div>
      )}
      {step.reason !== undefined && <p className="debug-panel-note">{step.reason}</p>}
    </li>
  );
}

/**
 * The algebraic matrix view: the circuit's operations laid out left to right like the circuit
 * itself, each as a card with its matrix and the state it leaves, over a chart of every state at
 * once. Both move with the playhead - stepping keeps the current step in the middle - and both
 * scroll sideways under a wheel, a trackpad or the keyboard.
 *
 * Every matrix is its column's structure, at any register size: written out while it fits a card,
 * drawn as discs a little past that, and drawn tile by tile, zoomable down to single entries,
 * beyond. The states come from the simulator, and the panel says whether every operator it shows
 * reproduces them. Choosing a step moves the playhead there, so the rest of the app follows along.
 */
function AlgebraPanel() {
  const circuitStats = useCircuitStats();
  const playheadSample = usePlayheadStats();
  const current = useStore(appStore, (s) => s.playheadState.step);
  const playhead = useStore(appStore, (s) => s.playhead);
  const algebra = useCircuitAlgebra(circuitStats, playheadSample?.wireCount);
  const trackRef = useRef(null);
  const ready = algebra !== undefined;
  const startGrid = useMemo(() => (ready ? stateGrid(algebra.states[0]) : undefined), [ready, algebra]);
  useWheelScrollsSideways(trackRef, ready);
  // The tile worker rebuilds the circuit from its JSON; one string per circuit, for every step.
  const circuit = circuitStats?.circuitDefinition;
  const circuitJson = useMemo(
    () => (circuit === undefined ? undefined : JSON.stringify(Serializer.toJson(circuit))),
    [circuit],
  );

  // Move with the playhead: whenever it steps, bring its card to the middle of the track. Only on
  // a step, never on a re-render, so scrolling by hand is not undone ten times a second.
  useEffect(() => {
    const track = trackRef.current;
    const card = track?.querySelector(`[data-step="${current}"]`);
    if (track !== null && card !== null && card !== undefined) {
      centreHorizontally(track, card.offsetLeft, card.offsetWidth);
    }
  }, [current, ready]);

  if (!ready) {
    return <p className="debug-panel-empty">Waiting for the circuit…</p>;
  }

  const { wireCount, states, steps } = algebra;
  const withOperator = steps.filter((step) => step.structure !== undefined);
  const checked = withOperator.filter((step) => step.residual !== undefined);
  const off = checked.filter((step) => step.residual >= 1e-5);
  const unchecked = withOperator.length - checked.length;
  const checkText =
    withOperator.length === 0
      ? "no step has a matrix to check"
      : off.length > 0
        ? `${off.length} step${off.length === 1 ? "" : "s"} differ from the simulation`
        : unchecked === 0
          ? "every matrix reproduces the simulated state"
          : `every checked matrix reproduces the simulated state; ${unchecked} too large to check`;
  const seek = (step) => playhead?.seek(step);

  return (
    <section className="debug-panel algebra-panel" aria-labelledby="algebra-heading">
      <header className="debug-panel-header">
        <h2 id="algebra-heading" className="debug-panel-heading">
          Operations and their matrices
        </h2>
        <span className="debug-panel-summary">
          {`${steps.length} step${steps.length === 1 ? "" : "s"} · ${wireCount} qubit${wireCount === 1 ? "" : "s"} · `}
          <span className={off.length === 0 ? "algebra-check-ok" : "algebra-check-off"}>{checkText}</span>
        </span>
      </header>

      <EvolutionChart states={states} wireCount={wireCount} current={current} />

      {/* Focusable so the arrow keys scroll it: a region you can only scroll with a mouse is not
          one everyone can scroll. */}
      <ol className="algebra-steps" ref={trackRef} tabIndex={0} aria-label="Steps, left to right">
        <li className="algebra-step" data-step={0} aria-current={current === 0 ? "step" : undefined}>
          <button type="button" className="algebra-step-header" onClick={() => seek(0)}>
            <span className="algebra-step-number">0</span>
            <span className="algebra-step-description">Start</span>
          </button>
          {(1 << wireCount) <= SYMBOLIC_MAX_ROWS ? (
            <math display="block" className="algebra-math" aria-label="The state before any step">
              <mrow>
                <msub>
                  <mi>ψ</mi>
                  <mn>0</mn>
                </msub>
                <mo>=</mo>
                <MatrixRow model={stateModel(states[0])} />
              </mrow>
            </math>
          ) : (
            <DataView
              kind="state"
              data={startGrid}
              {...plotSize(startGrid)}
              options={{ wireCount }}
              label="The state before any step"
            />
          )}
        </li>
        {steps.map((step, index) => (
          <StepCard
            key={index}
            index={index}
            step={step}
            before={states[index]}
            after={states[index + 1]}
            wireCount={wireCount}
            current={current === index + 1}
            onSeek={seek}
            source={{
              json: circuitJson,
              col: index,
              wireCount,
              // A time-independent step's tiles stay valid while time runs.
              time: step.column.stableDuration() === Infinity ? 0 : circuitStats.time,
            }}
          />
        ))}
      </ol>
    </section>
  );
}

export { AlgebraPanel };
