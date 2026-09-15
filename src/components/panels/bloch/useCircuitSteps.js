import { useMemo } from "react";

import { qubitMarginals } from "../../../engine/simulation/qubitMarginals.js";
import { useCircuitAlgebra } from "../algebra/useCircuitAlgebra.js";
import { useCompletedResult } from "../shared/usePlayheadStats.js";

/**
 * The qubit after every column of the circuit, for the strip of thumbnails, and which of those
 * steps is the one the analyzer was opened for.
 *
 * @param {import("./analyzerModel.js").BlochTarget | undefined} target
 * @returns {{
 *   steps: import("./analyzerModel.js").Step[],
 *   currentStep: (number | undefined),
 * }}
 */
function useCircuitSteps(target) {
  const completed = useCompletedResult();
  const algebra = useCircuitAlgebra(
    completed?.fullStats,
    completed?.wireCount,
  );
  const circuit = completed?.fullStats.circuitDefinition;

  const steps = useMemo(() => {
    if (algebra === undefined || target === undefined) return [];
    return algebra.states.map((state, index) => {
      // Impossible postselection has no normalized state. Match the marginal calculation's
      // normalization threshold, preserving the step with an unavailable vector.
      const norm = state.norm2();
      return {
        vec: Number.isFinite(norm) && norm > 1e-12
          ? qubitMarginals(state, algebra.wireCount, circuit.colIsMeasuredMask(index))[target.row]?.bloch
          : undefined,
        label:
          index === 0
            ? "in"
            : algebra.steps[index - 1].column.gates
                .filter((gate) => gate !== undefined)
                .map((gate) => gate.symbol)
                .join(" ") || "·",
      };
    });
  }, [algebra, target, circuit]);

  // A Bloch gate shows the state before its own column; a wire's output, the state after them all.
  const currentStep =
    target === undefined
      ? undefined
      : target.col !== undefined
        ? target.col
        : steps.length - 1;

  return { steps, currentStep };
}

export { useCircuitSteps };
