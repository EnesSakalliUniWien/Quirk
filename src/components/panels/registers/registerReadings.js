import { registerValue } from "../../../circuit/registerLabels.js";
import { qubitMarginals } from "../../../engine/simulation/qubitMarginals.js";
import { paddedState } from "../../../engine/simulation/stepAlgebra.js";

/** A value this unlikely cannot come out. */
const NEGLIGIBLE = 1e-9;

/**
 * Each register at the playhead: the values it can hold with their odds, and each of its qubits'
 * chance of reading 1.
 *
 * @param {!CircuitStats} stats
 * @param {!int} wireCount
 * @returns {!Array.<!{register: !Register, values: !Array.<!{value: !int, p: !number}>,
 *     qubits: !Array.<!{wire: !int, probabilityOne: !number}>}>}
 */
function registerReadings(stats, wireCount) {
  const { registers } = stats.circuitDefinition;
  const state = paddedState(stats.finalState, wireCount);
  const amplitudes = state.rawBuffer();
  const marginals = qubitMarginals(state, wireCount);
  const size = 1 << wireCount;
  const chance = (i) => amplitudes[i * 2] ** 2 + amplitudes[i * 2 + 1] ** 2;
  let total = 0;
  for (let i = 0; i < size; i++) {
    total += chance(i);
  }
  return registers.fittingIn(wireCount).list.map((register) => {
    const odds = new Map();
    for (let i = 0; i < size; i++) {
      const p = chance(i);
      if (p > 0) {
        const value = registerValue(register, i);
        odds.set(value, (odds.get(value) ?? 0) + p);
      }
    }
    // Relative to what is left, so post-selection reads as the odds among the survivors.
    const values = [...odds.entries()]
      .map(([value, p]) => ({ value, p: total > 0 ? p / total : 0 }))
      .filter(({ p }) => p > NEGLIGIBLE)
      .sort((a, b) => b.p - a.p || a.value - b.value);
    return {
      register,
      values,
      qubits: Array.from({ length: register.length }, (_, k) => marginals[register.start + k]),
    };
  });
}

export { registerReadings };
