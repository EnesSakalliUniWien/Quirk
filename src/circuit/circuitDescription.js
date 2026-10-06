/**
 * The circuit in words, for someone who hears it rather than sees it: its size, and what is in the
 * cell the keyboard is on. Text only, no drawing and no DOM, like gateDescription.js.
 */

import { gatesMeetingRange, occupiedColumns } from "./circuitRange.js";

/**
 * @param {!Gate} gate
 * @returns {!string} The name the gate goes by, as the gate palette names it.
 */
export function gateLabel(gate) {
  return gate.name || gate.symbol || gate.serializedId;
}

/**
 * @param {!int} n
 * @param {!string} word
 * @returns {!string}
 */
const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * @param {!CircuitDefinition} circuit
 * @returns {!string} Its size and how many gates it holds, such as "2 wires, 3 columns, 4 gates."
 */
export function describeCircuit(circuit) {
  const gates = circuit.columns.reduce(
    (n, column) => n + column.gates.filter((gate) => gate !== undefined).length,
    0,
  );
  return gates === 0
    ? `Empty circuit, ${count(circuit.numWires, "wire")}.`
    : `${count(circuit.numWires, "wire")}, ${count(occupiedColumns(circuit), "column")}, ${count(gates, "gate")}.`;
}

/**
 * @param {!CircuitDefinition} circuit
 * @param {!{col: !int, row: !int}} cell
 * @returns {undefined|!{col: !int, row: !int, gate: !Gate}} The gate whose footprint covers the cell,
 *     and the slot it starts in.
 */
export function gateCovering(circuit, { col, row }) {
  const [found] = gatesMeetingRange(circuit, {
    colStart: col,
    colEnd: col + 1,
    wireStart: row,
    wireEnd: row + 1,
  });
  return found === undefined
    ? undefined
    : { col: found.col, row: found.row, gate: found.gate };
}

/**
 * @param {!CircuitDefinition} circuit
 * @param {!{col: !int, row: !int}} cell
 * @returns {!string} Where the cell is and what is in it: "Wire 1, column 2: Hadamard Gate", or
 *     "empty"; "(off)" after a switched off gate; and in a cell a larger gate covers, where that gate
 *     starts. A cell just under the last wire is where a gate put down adds a wire.
 */
export function describeCell(circuit, cell) {
  const place = `${cell.row >= circuit.numWires ? "New wire" : "Wire"} ${cell.row + 1}, column ${cell.col + 1}`;
  const found = gateCovering(circuit, cell);
  if (found === undefined) {
    return `${place}: empty`;
  }
  const off = found.gate.deactivated ? " (off)" : "";
  const covered =
    found.col === cell.col && found.row === cell.row
      ? ""
      : `, part of the gate at wire ${found.row + 1}, column ${found.col + 1}`;
  return `${place}: ${gateLabel(found.gate)}${off}${covered}`;
}
