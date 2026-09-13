import { useMemo, useRef } from "react";
import { circuitAlgebra } from "../../../engine/simulation/stepAlgebra.js";

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
      last.algebra.wireCount === wireCount && last.seed === stats.seed &&
      last.circuit.isEqualTo(circuit) &&
      (circuit.stableDuration() === Infinity || last.time === stats.time)
    ) {
      return last.algebra;
    }
    const algebra = circuitAlgebra(stats, wireCount, last?.algebra);
    cache.current = { circuit, time: stats.time, seed: stats.seed, algebra };
    return algebra;
  }, [stats, wireCount]);
}

export { useCircuitAlgebra };
