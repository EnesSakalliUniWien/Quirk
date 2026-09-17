/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Rendering} from "../../config/Rendering.js";
import {equate_Maps} from "../../base/Equate.js"
import {Registers} from "../../circuit/model/Registers.js"
import {wiresLabel} from "../../circuit/registerLabels.js"
import {Matrix} from "../math/matrix/Matrix.js"
import {CircuitStats} from "./CircuitStats.js"
import {columnStructure} from "./columnStructure/columnStructure.js";
import {applyStructure, structureMatrix} from "./columnStructure/evaluation.js";

/**
 * The circuit as algebra: every column as an operator, and the state before and after each one, so
 * `state[k+1] = U[k] · state[k]` can be read down the whole circuit.
 *
 * Each operator is its column's structure (src/engine/simulation/columnStructure/columnStructure.js): the pieces the
 * engine applies, not a dense matrix, so it exists at every register size and a view asks it for
 * just the entries it shows. Small registers also get the dense matrix, for the views that write
 * out every entry. Each step is checked against the simulator: its operator applied to the state
 * before it must give the simulated state after it.
 */

/** Up to this many qubits a step's dense matrix - 32 x 32 at most - is built as well. */
const DENSE_MATRIX_WIRES = Rendering.MATRIX_DETAIL_MAX_QUBITS;
/** How many amplitude updates checking one step may take; a step past it goes unchecked. */
const CHECK_BUDGET = 1 << 14;

/**
 * A simulated state as a column vector over `wireCount` qubits.
 *
 * The simulator drops wires nothing touches, so its state can be shorter than the circuit on
 * screen. Those wires stayed |0>, so the short state is a prefix of the full one and the rest is
 * zero - the same reading src/engine/simulation/stateTableRows.js makes.
 *
 * @param {!Matrix} finalState
 * @param {!int} wireCount
 * @returns {!Matrix}
 */
function paddedState(finalState, wireCount) {
    const size = 1 << wireCount;
    const source = finalState.rawBuffer();
    const buffer = new Float64Array(size * 2);
    buffer.set(source.subarray(0, Math.min(source.length, buffer.length)));
    return new Matrix(1, size, buffer);
}

/**
 * The state after the circuit's first `step` columns, from a truncated run of the simulator at the
 * stats' time and seed, so it is what the circuit really produces up to there.
 *
 * @param {!CircuitStats} stats The stats of the whole circuit.
 * @param {!int} wireCount
 * @param {!int} step How many columns have run, from 0 to the column count.
 * @returns {!Matrix}
 */
function stateAtStep(stats, wireCount, step) {
    const circuit = stats.circuitDefinition;
    if (step >= circuit.columns.length) {
        return paddedState(stats.finalState, wireCount);
    }
    const truncated = circuit.withColumns(circuit.columns.slice(0, step));
    return paddedState(CircuitStats.fromCircuitAtTime(truncated, stats.time, stats.seed).finalState, wireCount);
}

/**
 * The largest difference between two states' amplitudes. Near zero means the operator on screen
 * does exactly what the simulator did.
 *
 * @param {!Matrix} a
 * @param {!Matrix} b
 * @returns {!number}
 */
function stateDistance(a, b) {
    const x = a.rawBuffer();
    const y = b.rawBuffer();
    let worst = 0;
    for (let i = 0; i < y.length; i += 2) {
        worst = Math.max(worst, Math.hypot(x[i] - y[i], x[i + 1] - y[i + 1]));
    }
    return worst;
}

/**
 * The column in words: what acts on which qubit, and under which condition.
 *
 * @param {!GateColumn} column
 * @param {!Registers=} registers Name wires by register, when the circuit has any.
 * @returns {!string}
 */
function describeColumn(column, registers = Registers.EMPTY) {
    const actions = [];
    const conditions = [];
    column.gates.forEach((gate, row) => {
        if (gate === undefined) {
            return;
        }
        const wires = wiresLabel(registers, row, gate.height);
        if (gate.isControl()) {
            const bit = gate.controlBit();
            conditions.push(bit === true ? `${wires} is 1` : bit === false ? `${wires} is 0` : `${wires} is ${bit}`);
        } else {
            actions.push(`${gate.name} on ${wires}${gate.definitelyHasNoEffect() ? " (no effect)" : ""}`);
        }
    });
    if (actions.length === 0) {
        return conditions.length === 0 ? "Nothing - the identity" : `Only controls, on ${conditions.join(", ")}`;
    }
    return actions.join(", ") + (conditions.length === 0 ? "" : `, if ${conditions.join(" and ")}`);
}

/**
 * The whole circuit as a list of steps.
 *
 * States come from the simulator, one truncated run per step, so every one is what the circuit
 * really produces. A time-independent column's operator is reused from `previous` while the column,
 * which of its gates are enabled and the inputs earlier columns set are unchanged - reading the
 * list while a time-dependent gate spins elsewhere then only rebuilds that gate's step.
 *
 * @param {!CircuitStats} stats The stats of the whole circuit.
 * @param {!int} wireCount
 * @param {undefined|!CircuitAlgebra} previous
 * @returns {!CircuitAlgebra}
 *
 * @typedef {!{wireCount: !int, states: !Array.<!Matrix>, steps: !Array.<!{
 *     column: !GateColumn, reasons: !Array.<undefined|!string>, context: !Map.<!string, *>,
 *     description: !string, structure: (undefined|!ColumnStructure), matrix: (undefined|!Matrix),
 *     reason: (undefined|!string), residual: (undefined|!number)}>}} CircuitAlgebra
 */
function circuitAlgebra(stats, wireCount, previous = undefined) {
    const circuit = stats.circuitDefinition;
    const {columns} = circuit;
    const states = Array.from({length: columns.length + 1}, (_, k) => stateAtStep(stats, wireCount, k));

    const steps = columns.map((column, k) => {
        const reasons = Array.from({length: wireCount}, (_, row) => circuit.gateAtLocIsDisabledReason(k, row));
        const context = circuit.colCustomContextFromGates(k, 0);
        const old = previous !== undefined && previous.wireCount === wireCount ? previous.steps[k] : undefined;
        const reusable = old !== undefined &&
            column.stableDuration() === Infinity &&
            old.column.isEqualTo(column) &&
            old.reasons.every((reason, row) => reason === reasons[row]) &&
            equate_Maps(old.context, context);
        let structure, matrix, reason;
        if (reusable) {
            ({structure, matrix, reason} = old);
        } else {
            const built = columnStructure(circuit, k, wireCount, stats.time);
            structure = built.ok ? built : undefined;
            reason = built.ok ? undefined : built.reason;
            matrix = structure !== undefined && wireCount <= DENSE_MATRIX_WIRES ? structureMatrix(structure) : undefined;
        }
        const predicted = structure === undefined ? undefined : applyStructure(structure, states[k], CHECK_BUDGET);
        return {
            column,
            reasons,
            context,
            description: describeColumn(column, circuit.registers),
            structure,
            matrix,
            reason,
            residual: predicted === undefined ? undefined : stateDistance(predicted, states[k + 1]),
        };
    });
    return {wireCount, states, steps};
}

export {circuitAlgebra, describeColumn, paddedState, stateAtStep}
