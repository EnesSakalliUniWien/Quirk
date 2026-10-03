import { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { circuitAlgebra, releaseStepStates } from "../../../engine/simulation/stepAlgebra.js";
import { appStore } from "../../../state/appStore.js";

/**
 * The last algebra worked out, shared by every panel that reads it: the Algebra and Bloch panels
 * show the same circuit, and each working it out on its own would double the cost of a sample.
 * @type {undefined|!{circuit: !CircuitDefinition, time: !number, seed: *, algebra: !CircuitAlgebra}}
 */
let shared = undefined;

/**
 * How many mounted components are using the hook. The shared algebra holds every step's state and
 * matrix, so it goes when the last of them closes, not when the page does.
 */
let users = 0;

/**
 * The whole circuit's algebra, recomputed only when something it depends on changed: an unchanged
 * circuit reuses the last answer outright, and a changed one still reuses every time-independent
 * column's matrix (see circuitAlgebra).
 *
 * The states after the columns before the first that moves with time are worked out from what the
 * simulator keeps of them (its StablePrefix; see stepStates), when it keeps them for this circuit.
 *
 * @param {undefined|!CircuitStats} stats
 * @param {undefined|!int} wireCount
 * @returns {undefined|!CircuitAlgebra}
 */
function useCircuitAlgebra(stats, wireCount) {
  const prefix = useStore(appStore, (s) => s.panelDeps?.stablePrefix);
  useEffect(() => {
    users++;
    return () => {
      users--;
      if (users === 0) {
        shared = undefined;
        releaseStepStates();
      }
    };
  }, []);
  return useMemo(() => {
    if (stats === undefined || wireCount === undefined) {
      return undefined;
    }
    const last = shared;
    const circuit = stats.circuitDefinition;
    if (
      last !== undefined &&
      last.algebra.wireCount === wireCount && last.seed === stats.seed &&
      last.circuit.isEqualTo(circuit) &&
      (circuit.stableDuration() === Infinity || last.time === stats.time)
    ) {
      return last.algebra;
    }
    const algebra = circuitAlgebra(stats, wireCount, last?.algebra, prefix);
    shared = { circuit, time: stats.time, seed: stats.seed, algebra };
    return algebra;
  }, [stats, wireCount, prefix]);
}

export { useCircuitAlgebra };
