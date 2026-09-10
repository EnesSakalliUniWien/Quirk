import { useMemo } from "react";

import { Util } from "../../base/Util.js";
import { Matrix } from "../../engine/math/matrix/Matrix.js";
import { paddedState } from "../../engine/simulation/stepAlgebra.js";
import { DataView } from "../math/data-view.jsx";
import { usePlayheadStats } from "./usePlayheadStats.js";

/** How wide the bars are drawn, in pixels. */
const CHART_WIDTH = 360;
/** The tallest the chart grows; past this its rows get thinner rather than the chart longer. */
const CHART_MAX_HEIGHT = 360;
/** The height a row takes while there are few enough of them. */
const ROW_HEIGHT = 22;
/** A row must be at least this tall to carry a ket label beside it. */
const LABELLED_ROW_HEIGHT = 12;
/** Outcomes at or below this probability cannot come out. */
const NEGLIGIBLE = 1e-12;

/**
 * Measurement odds at the playhead: every basis state's probability, drawn by the same renderer as
 * the circuit's probability display - a bar per state, with its percentage while the rows are tall
 * enough and a logarithmic hint when they are not. Every outcome is drawn, however many qubits.
 */
function ProbabilitiesPanel() {
  const sample = usePlayheadStats();

  const distribution = useMemo(() => {
    if (sample === undefined) {
      return undefined;
    }
    const { stats, wireCount } = sample;
    const amplitudes = paddedState(stats.finalState, wireCount).rawBuffer();
    const size = 1 << wireCount;
    const buffer = new Float64Array(size * 2);
    const outcomes = [];
    for (let i = 0; i < size; i++) {
      const p = amplitudes[i * 2] ** 2 + amplitudes[i * 2 + 1] ** 2;
      buffer[i * 2] = p;
      if (p > NEGLIGIBLE) {
        outcomes.push({ ket: Util.bin(i, wireCount), p });
      }
    }
    return { wireCount, size, outcomes, probabilities: new Matrix(1, size, buffer) };
  }, [sample]);

  if (distribution === undefined) {
    return <p className="debug-panel-empty">Waiting for the circuit…</p>;
  }

  const { wireCount, size, outcomes, probabilities } = distribution;
  const height = Math.min(CHART_MAX_HEIGHT, size * ROW_HEIGHT);
  const rowHeight = height / size;
  const labelled = rowHeight >= LABELLED_ROW_HEIGHT;
  const label =
    outcomes.length <= 32
      ? `Probability of each outcome at the playhead: ${outcomes
          .map(({ ket, p }) => `|${ket}⟩ ${(p * 100).toFixed(1)}%`)
          .join(", ")}`
      : `Probabilities of ${outcomes.length} possible outcomes over ${size} basis states`;

  return (
    <section className="debug-panel" aria-labelledby="probabilities-heading">
      <header className="debug-panel-header">
        <h2 id="probabilities-heading" className="debug-panel-heading">
          Measurement probabilities
        </h2>
        <span className="debug-panel-summary">
          {`${outcomes.length} of ${size} outcomes possible`}
        </span>
      </header>
      <div className="probabilities-view" style={{ "--probability-row": `${rowHeight}px` }}>
        {labelled && (
          <ol className="probabilities-kets" aria-hidden="true">
            {Array.from({ length: size }, (_, i) => (
              <li key={i}>{`|${Util.bin(i, wireCount)}⟩`}</li>
            ))}
          </ol>
        )}
        <DataView
          kind="probabilities"
          className="probabilities-chart"
          data={probabilities}
          width={CHART_WIDTH}
          height={height}
          options={{ wireCount }}
          label={label}
        />
      </div>
    </section>
  );
}

export { ProbabilitiesPanel };
