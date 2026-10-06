import { useMemo } from "react";

import { qubitMarginals } from "../../../engine/simulation/qubitMarginals.js";
import { useCircuitAlgebra } from "../algebra/useCircuitAlgebra.js";

/**
 * The qubit after every column of the circuit, for the strip of thumbnails, and which of those
 * steps is the one the analyzer shows: a Bloch gate's own column, or for a wire's output the step
 * the playhead stands at, as the canvas's outputs follow it - the last step when it rests at the end.
 *
 * @param {import("./analyzerModel.js").BlochTarget | undefined} target
 * @param {Object | undefined} completed The completed simulation as panels sample it
 *     (useCompletedResult).
 * @returns {{
 *   steps: import("./analyzerModel.js").Step[],
 *   currentStep: (number | undefined),
 * }}
 */
function useCircuitSteps(target, completed) {
  const algebra = useCircuitAlgebra(completed?.fullStats, completed?.wireCount);
  const circuit = completed?.fullStats.circuitDefinition;

  const steps = useMemo(() => {
    if (algebra === undefined || target === undefined) return [];
    return algebra.states.map((state, index) => {
      // Impossible postselection has no normalized state. Match the marginal calculation's
      // normalization threshold, preserving the step with an unavailable vector.
      const norm = state.norm2();
      const gates =
        index === 0
          ? ""
          : algebra.steps[index - 1].column.gates
              .filter((gate) => gate !== undefined)
              .map((gate) => gate.symbol)
              .join(" ");
      return {
        vec:
          Number.isFinite(norm) && norm > 1e-12
            ? qubitMarginals(
                state,
                algebra.wireCount,
                circuit.colIsMeasuredMask(index),
              )[target.row]?.bloch
            : undefined,
        label: index === 0 ? "start" : gates || "·",
        // The step's whole name, for assistive technology: where it stands and what the column holds.
        name:
          index === 0
            ? "Start, before the first column"
            : `After column ${index}${gates === "" ? ", which is empty" : `: ${gates}`}`,
      };
    });
  }, [algebra, target, circuit]);

  // A Bloch gate shows the state before its own column; a wire's output, the state at the playhead.
  const playheadStep = completed?.step ?? steps.length - 1;
  const currentStep =
    target === undefined
      ? undefined
      : target.col !== undefined
        ? target.col
        : Math.max(0, Math.min(steps.length - 1, playheadStep));

  return { steps, currentStep };
}

export { useCircuitSteps };
