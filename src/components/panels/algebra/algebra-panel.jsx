import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { bin } from "../../../base/Format.js";
import { ketLabel } from "../../../circuit/registerLabels.js";
import { Serializer } from "../../../serialization/Serializer.js";
import { appStore } from "../../../state/appStore.js";
import { useMatrixLayout } from "../../math/useMatrixLayout.js";
import { useCompletedResult } from "../shared/usePlayheadStats.js";
import { useCircuitAlgebra } from "./useCircuitAlgebra.js";
import { useWheelScrollsSideways } from "./useWheelScrollsSideways.js";
import { EvolutionChart } from "./evolution-chart.jsx";
import { StateFactor } from "./state-factor.jsx";
import { StepCard } from "./step-card.jsx";

/**
 * The algebraic matrix view: the circuit's operations laid out left to right like the circuit
 * itself, each as a card with its matrix and the state it leaves, over a chart of every state at
 * once. Both move with the playhead - stepping keeps the current step in the middle - and both
 * support horizontal gestures, shift+wheel and keyboard scrolling.
 *
 * Every matrix is its column's structure, at any register size: written out while it fits a card,
 * otherwise plotted with zoom down to single entries, using tiles for large structures.
 * The states come from the simulator, and the panel says whether every operator it shows
 * reproduces them. Choosing a step moves the playhead there, so the rest of the app follows along.
 */
function AlgebraPanel() {
  const result = useCompletedResult();
  const circuitStats = result?.fullStats;
  const playheadSample = result;
  const current = result?.step ?? 0;
  const playhead = useStore(appStore, (s) => s.playhead);
  const algebra = useCircuitAlgebra(circuitStats, playheadSample?.wireCount);
  const trackRef = useRef(null);
  const ready = algebra !== undefined;
  useMatrixLayout(trackRef, algebra);
  useWheelScrollsSideways(trackRef, ready);
  // The tile worker rebuilds the circuit from its JSON; one string per circuit, for every step.
  const circuit = circuitStats?.circuitDefinition;
  const circuitJson = useMemo(
    () => (circuit === undefined ? undefined : JSON.stringify(Serializer.toJson(circuit))),
    [circuit],
  );
  // Kets by register, the way every other view writes them; bits when there are none.
  const registers = circuit?.registers;
  const shownWires = playheadSample?.wireCount;
  const formatKet = useMemo(
    () =>
      registers === undefined || shownWires === undefined || registers.isEmpty()
        ? undefined
        : (index) => ketLabel(registers, shownWires, index),
    [registers, shownWires],
  );

  // Move with the playhead: whenever it steps, bring its card to the middle of the track. Only on
  // a step, never on a re-render, so scrolling by hand is not undone ten times a second.
  useEffect(() => {
    const track = trackRef.current;
    const card = track?.querySelector(`[data-step="${current}"]`);
    if (track !== null && card !== null && card !== undefined) {
      const left = card.offsetLeft;
      const right = left + card.offsetWidth;
      if (left < track.scrollLeft || right > track.scrollLeft + track.clientWidth) {
        track.scrollTo({left: card.offsetWidth > track.clientWidth ? left : Math.max(0, right - track.clientWidth),
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
      }
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
      {circuit.columns.some((_, col) => circuit.colIsMeasuredMask(col + 1) !== 0) && <p className="debug-panel-note">After deferred measurement, these kets are simulation amplitudes; use density matrices for the physical state.</p>}
      <header className="debug-panel-header">
        <h2 id="algebra-heading" className="debug-panel-heading">
          Operations and their matrices
        </h2>
        <span className="debug-panel-summary">
          {`${steps.length} step${steps.length === 1 ? "" : "s"} · ${wireCount} qubit${wireCount === 1 ? "" : "s"} · `}
          <span className={off.length === 0 ? "algebra-check-ok" : "algebra-check-off"}>{checkText}</span>
        </span>
      </header>

      <EvolutionChart states={states} wireCount={wireCount} current={current} formatKet={formatKet} />

      {/* Focusable so the arrow keys scroll it: a region you can only scroll with a mouse is not
          one everyone can scroll. */}
      <ol className="algebra-steps" ref={trackRef} tabIndex={0} aria-label="Steps, left to right">
        <li className="algebra-step" data-step={0} aria-current={current === 0 ? "step" : undefined}>
          <button type="button" className="algebra-step-header" onClick={() => seek(0)}>
            <span className="algebra-step-number">0</span>
            <span className="algebra-step-description">Start</span>
          </button>
          <div className="algebra-equation">
            <StateFactor state={states[0]} step={0} wireCount={wireCount} formatKet={formatKet} label="Initial state" />
          </div>
          <p className="algebra-step-note">Basis order: {Array.from({length: Math.min(8, 1 << wireCount)}, (_, i) =>
            "|" + (formatKet === undefined ? bin(i, wireCount) : formatKet(i)) + "⟩").join(", ")}{wireCount > 3 ? ", …" : ""}.</p>
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
            formatKet={formatKet}
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
