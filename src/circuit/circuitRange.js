/**
 * A rectangle of a circuit: half-open ranges of columns and wires, the shape a selection, a copied
 * block and a gate made from part of the circuit all share. A gate belongs to a range when its
 * whole footprint - every column of its width, every wire of its height - lies inside it.
 */

import { CircuitDefinition } from "./model/CircuitDefinition.js";
import { GateColumn } from "./model/GateColumn.js";
import { Simulation } from "../config/Simulation.js";

/**
 * @typedef {!{colStart: !int, colEnd: !int, wireStart: !int, wireEnd: !int}} CircuitRange
 */

/**
 * Serialized circuits can omit the empty columns a wide gate's end covers, so the circuit can reach
 * past its last column.
 *
 * @param {!CircuitDefinition} circuit
 * @returns {!int} The columns the circuit's gates occupy, counting the ends of wide gates.
 */
export function occupiedColumns(circuit) {
  return circuit.columns.reduce(
    (end, column, col) =>
      Math.max(
        end,
        ...column.gates.map((gate) => (gate ? col + gate.width : 0)),
      ),
    circuit.columns.length,
  );
}

/**
 * @param {!CircuitDefinition} circuit
 * @param {!{col: !int, row: !int}} cell
 * @returns {!{col: !int, row: !int}} The cell kept where a gate can be put down: on the circuit's
 *     wires or one under them, where a gate adds a wire, and from the first column to the empty one
 *     after the last, where a gate adds a column.
 */
export function clampCell(circuit, { col, row }) {
  const lastRow = Math.min(circuit.numWires, Simulation.MAX_WIRE_COUNT - 1);
  return {
    col: Math.max(0, Math.min(occupiedColumns(circuit), col)),
    row: Math.max(0, Math.min(lastRow, row)),
  };
}

/**
 * @param {!{col: !int, row: !int}} a
 * @param {!{col: !int, row: !int}} b
 * @returns {!CircuitRange} The range with the two cells as opposite corners.
 */
export function rangeFromCells(a, b) {
  return Object.freeze({
    colStart: Math.min(a.col, b.col),
    colEnd: Math.max(a.col, b.col) + 1,
    wireStart: Math.min(a.row, b.row),
    wireEnd: Math.max(a.row, b.row) + 1,
  });
}

/**
 * @param {!CircuitDefinition} circuit
 * @param {!CircuitRange} range
 * @returns {!Array.<!{col: !int, row: !int, gate: !Gate, inside: !boolean}>} Every gate whose
 *     footprint meets the range, and whether all of it lies inside.
 */
export function gatesMeetingRange(
  circuit,
  { colStart, colEnd, wireStart, wireEnd },
) {
  const met = [];
  circuit.columns.forEach((column, col) =>
    column.gates.forEach((gate, row) => {
      if (
        !gate ||
        col >= colEnd ||
        col + gate.width <= colStart ||
        row >= wireEnd ||
        row + gate.height <= wireStart
      ) {
        return;
      }
      const inside =
        col >= colStart &&
        col + gate.width <= colEnd &&
        row >= wireStart &&
        row + gate.height <= wireEnd;
      met.push({ col, row, gate, inside });
    }),
  );
  return met;
}

/**
 * Grows the range until it cuts through no gate. A gate it takes in can reach further still, so
 * the growing repeats until nothing more is cut.
 *
 * @param {!CircuitDefinition} circuit
 * @param {!CircuitRange} range
 * @returns {!CircuitRange}
 */
export function expandToWholeGates(circuit, range) {
  let result = range;
  for (;;) {
    const cut = gatesMeetingRange(circuit, result).filter((e) => !e.inside);
    if (cut.length === 0) {
      return Object.freeze({ ...result });
    }
    result = cut.reduce(
      (r, { col, row, gate }) => ({
        colStart: Math.min(r.colStart, col),
        colEnd: Math.max(r.colEnd, col + gate.width),
        wireStart: Math.min(r.wireStart, row),
        wireEnd: Math.max(r.wireEnd, row + gate.height),
      }),
      result,
    );
  }
}

/**
 * The range's gates as a circuit of their own, the range's first wire as its first. A gate the
 * range only partly covers is left out. Registers, initial states and custom gate definitions stay
 * with the circuit, so custom gates in the slice serialize with their own definitions.
 *
 * @param {!CircuitDefinition} circuit
 * @param {!CircuitRange} range
 * @returns {!CircuitDefinition}
 */
export function sliceCircuit(
  circuit,
  { colStart, colEnd, wireStart, wireEnd },
) {
  // The range can run past the last column into the end of a wide gate.
  const width = Math.max(
    0,
    Math.min(colEnd, occupiedColumns(circuit)) - colStart,
  );
  const height = wireEnd - wireStart;
  return new CircuitDefinition(
    height,
    Array.from(
      { length: width },
      (_, c) =>
        new GateColumn(
          Array.from({ length: height }, (_, r) => {
            const gate = circuit.columns[colStart + c]?.gates[wireStart + r];
            return gate === undefined ||
              c + gate.width > width ||
              r + gate.height > height
              ? undefined
              : gate;
          }),
        ),
    ),
  );
}

/**
 * What the range's gates rely on from outside it, and so lose when the range is copied or made
 * into a gate: a control on another wire of their column, the other half of a swap, and inputs no
 * gate inside the range provides.
 *
 * @param {!CircuitDefinition} circuit
 * @param {!CircuitRange} range
 * @returns {!Array.<!{kind: ('control'|'swap'), col: !int, row: !int, gate: !Gate}|!{kind: 'input', key: !string}>}
 */
export function outsideDependencies(circuit, range) {
  const found = [];
  for (
    let col = range.colStart;
    col < Math.min(range.colEnd, circuit.columns.length);
    col++
  ) {
    const gates = circuit.columns[col].gates;
    const inside = gates
      .slice(range.wireStart, range.wireEnd)
      .filter((gate) => gate !== undefined);
    // Controls alone act on nothing inside the range.
    if (inside.every((gate) => gate.isControl())) {
      continue;
    }
    const swapInside = inside.some((gate) => gate.isSwapHalf);
    gates.forEach((gate, row) => {
      if (
        gate === undefined ||
        (row >= range.wireStart && row < range.wireEnd)
      ) {
        return;
      }
      if (gate.isControl()) {
        found.push({ kind: "control", col, row, gate });
      } else if (gate.isSwapHalf && swapInside) {
        found.push({ kind: "swap", col, row, gate });
      }
    });
  }
  for (const key of sliceCircuit(circuit, range).getUnmetContextKeys()) {
    found.push({ kind: "input", key });
  }
  return found;
}
