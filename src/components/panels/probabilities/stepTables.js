import { bin } from "../../../base/Format.js";
import { operationColumns } from "../../../circuit/operationColumns.js";
import { ketLabel, wireLabel } from "../../../circuit/registerLabels.js";
import {
  independentGroups,
  marginalProbabilities,
} from "../../../draw/displays/probability/ProbabilityBlocks.js";
import { ZERO_PROBABILITY } from "../../../draw/displays/probability/ProbabilityScale.js";
import { Matrix } from "../../../engine/math/matrix/Matrix.js";
import { describeColumn } from "../../../engine/simulation/stepAlgebra.js";

/**
 * The Probabilities panel's model: the transport's steps through the circuit, and one table per
 * distribution with an outcome per row and a step per column, so every step can be compared at a
 * glance. Nothing here renders or touches the DOM.
 */

/** A table shows every outcome up to this many; past it, the likeliest outcomes some step allows. */
const MAX_ROWS = 32;

/** A chance that moved less than this between two steps did not change. */
const CHANGE_TOLERANCE = 1e-6;

/**
 * @typedef {{ column: number, label: string, description: string }} StepStop How many columns have
 *     run at a stop, the gates of the column that got there as they are drawn ("Start" before any),
 *     and that column in words.
 * @typedef {{ index: number, ket: string, values: number[], changes: Array<(-1 | 0 | 1 | undefined)> }}
 *     StepRow An outcome, its chance after each step, and whether each step raised it (1), lowered
 *     it (-1) or left it (0); the start has nothing before it.
 * @typedef {{ key: string, title: (string | undefined), rows: StepRow[], largest: number,
 *     hidden: number }} StepTable One distribution over the steps: largest is the scale every bar
 *     in it shares, hidden how many outcomes it leaves out.
 */

/**
 * The stops the transport steps through, as Playhead has them: before any column, then after each
 * column that operates, the last taking in the displays after it.
 *
 * @param {import("../../../circuit/model/CircuitDefinition.js").CircuitDefinition} circuit
 * @returns {StepStop[]}
 */
function stepStops(circuit) {
  const operations = operationColumns(circuit);
  return [
    { column: 0, label: "Start", description: "The input state, before any column" },
    ...operations.map((col, i) => ({
      column: i === operations.length - 1 ? circuit.columns.length : col + 1,
      label:
        circuit.columns[col].gates
          .filter((gate) => gate !== undefined)
          .map((gate) => gate.symbol)
          .join(" ") || "·",
      description: describeColumn(circuit.columns[col], circuit.registers),
    })),
  ];
}

/**
 * @param {Matrix} state A column of amplitudes.
 * @returns {Float64Array} Each outcome's probability.
 */
function probabilitiesOf(state) {
  const amplitudes = state.rawBuffer();
  const probabilities = new Float64Array(amplitudes.length / 2);
  for (let i = 0; i < probabilities.length; i++) {
    probabilities[i] = amplitudes[i * 2] ** 2 + amplitudes[i * 2 + 1] ** 2;
  }
  return probabilities;
}

/**
 * The groups of wires every step can be read by: wires that are correlated at any step share a
 * group, so each table's rows mean the same thing in every column. At each step the joint chance
 * is still the product of the groups', since joining independent groups keeps that true.
 *
 * @param {Float64Array[]} steps
 * @param {number} wireCount
 * @returns {number[][]} Groups ordered by lowest wire, each ascending.
 */
function sharedGroups(steps, wireCount) {
  const parent = Array.from({ length: wireCount }, (_, wire) => wire);
  const root = (wire) => (parent[wire] === wire ? wire : (parent[wire] = root(parent[wire])));
  for (const probabilities of steps) {
    const total = probabilities.reduce((sum, p) => sum + p, 0);
    // A step that cannot happen, after an impossible postselection, has no correlations to read.
    if (!(total > ZERO_PROBABILITY)) continue;
    const column = new Float64Array(probabilities.length * 2);
    probabilities.forEach((p, i) => { column[i * 2] = p; });
    for (const { wires } of independentGroups(new Matrix(1, probabilities.length, column), wireCount)) {
      for (const wire of wires.slice(1)) parent[root(wire)] = root(wires[0]);
    }
  }
  const groups = new Map();
  for (let wire = 0; wire < wireCount; wire++) {
    groups.set(root(wire), [...(groups.get(root(wire)) ?? []), wire]);
  }
  return [...groups.values()];
}

/**
 * @param {string} key
 * @param {string | undefined} title
 * @param {Float64Array[]} steps
 * @param {(index: number) => string} ketOf
 * @returns {StepTable}
 */
function table(key, title, steps, ketOf) {
  const size = steps[0].length;
  const peak = new Float64Array(size);
  for (const probabilities of steps) {
    probabilities.forEach((p, i) => { if (p > peak[i]) peak[i] = p; });
  }
  let indices = Array.from({ length: size }, (_, i) => i);
  if (size > MAX_ROWS) {
    indices = indices
      .filter((i) => peak[i] > ZERO_PROBABILITY)
      .sort((a, b) => peak[b] - peak[a] || a - b)
      .slice(0, MAX_ROWS)
      .sort((a, b) => a - b);
  }
  return {
    key,
    title,
    largest: peak.reduce((largest, p) => Math.max(largest, p), 0),
    hidden: size - indices.length,
    rows: indices.map((index) => {
      const values = steps.map((probabilities) => probabilities[index]);
      return {
        index,
        ket: ketOf(index),
        values,
        changes: values.map((p, step) => {
          if (step === 0) return undefined;
          const change = p - values[step - 1];
          return Math.abs(change) > CHANGE_TOLERANCE ? Math.sign(change) : 0;
        }),
      };
    }),
  };
}

/**
 * @param {Float64Array[]} steps Each outcome's probability after each step.
 * @param {"index" | "grouped"} layout One table of every outcome, or one per group of wires
 *     correlated at some step.
 * @param {number} wireCount
 * @param {import("../../../circuit/model/Registers.js").Registers} registers
 * @returns {StepTable[]}
 */
function stepTables(steps, layout, wireCount, registers) {
  if (layout === "index") {
    return [table("all", undefined, steps, (index) => ketLabel(registers, wireCount, index))];
  }
  return sharedGroups(steps, wireCount).map((wires) => {
    const names = [...wires].reverse().map((wire) => wireLabel(registers, wire)).join(" ");
    return table(
      wires.join(","),
      `${names} · ${wires.length === 1 ? "independent" : "correlated"}`,
      steps.map((probabilities) => marginalProbabilities(probabilities, wires)),
      (index) => bin(index, wires.length),
    );
  });
}

export { MAX_ROWS, probabilitiesOf, stepStops, stepTables };
