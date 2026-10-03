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
 * A state as a column vector over `wireCount` qubits, as it is if it already is one, else padded by
 * paddedState.
 *
 * @param {!Matrix} state
 * @param {!int} wireCount
 * @returns {!Matrix}
 */
function overWires(state, wireCount) {
    return state.height() === 1 << wireCount ? state : paddedState(state, wireCount);
}

/**
 * The last step states worked out, whichever panel asked: the Algebra, Bloch and Probabilities
 * panels trace the same circuit, and share one run's states rather than each running it again.
 *
 * It holds every state of the circuit, a megabyte or so each at 16 qubits, so it is let go of by
 * releaseStepStates when the panels that read it close.
 * @type {undefined|!{stats: !CircuitStats, wireCount: !int, circuit: !CircuitDefinition, seed: *, states: !Array.<!Matrix>}}
 */
let lastStepStates = undefined;

/**
 * Lets go of the step states kept for the panels to share, which would otherwise stay as long as the
 * page does. Called when the last panel that traces the circuit closes; the next to open works them
 * out again.
 */
function releaseStepStates() {
    lastStepStates = undefined;
}

/**
 * The state before the circuit's first column and after each one, over `wireCount` qubits: what the
 * circuit really produces up to each step, at the stats' time and seed.
 *
 * One run of the simulator gives them all (CircuitStats.statesAfterSteps), not a run per step, and
 * the answer is shared: the same stats get the same states back. States that cannot have changed are
 * kept from `previous`, or else from the last answer: those before the first time-dependent column,
 * while the columns before them, the wires, the initial values and the seed are unchanged. A
 * spinning gate then only reads back the states from its own column on.
 *
 * Each state is renormalized and padded to `wireCount` qubits as it comes out of the readback, not
 * copied again to pad it, and the final state is used as the stats hold it when it already spans
 * `wireCount` qubits.
 *
 * @param {!CircuitStats} stats The stats of the whole circuit.
 * @param {!int} wireCount
 * @param {undefined|!{wireCount: !int, circuit: !CircuitDefinition, seed: *, states: !Array.<!Matrix>}} previous
 * @param {undefined|!StablePrefix=} prefix What the simulator keeps of the circuit's columns before the
 *     first that moves with time. When it holds them for this circuit and seed, the run for the states
 *     after the later columns starts from it, and applies only those columns. The states are the same
 *     whether or not it is given.
 * @returns {!Array.<!Matrix>} One state per step, from 0 to the column count.
 */
function stepStates(stats, wireCount, previous = undefined, prefix = undefined) {
    const last = lastStepStates;
    if (last !== undefined && last.stats === stats && last.wireCount === wireCount) {
        return last.states;
    }
    const source = previous ?? last;
    const circuit = stats.circuitDefinition;
    const count = circuit.columns.length;
    const kept = Math.min(count + 1, reusableStateCount(stats, wireCount, source));
    // The state after the last column is the whole circuit's final state, which the stats hold.
    const ran = stats.statesAfterSteps(
        Array.from({length: Math.max(0, count - kept)}, (_, i) => kept + i), prefix, wireCount);
    const states = Array.from({length: count + 1}, (_, k) =>
        k < kept ? source.states[k] :
        k === count ? overWires(stats.finalState, wireCount) :
        ran[k - kept]);
    lastStepStates = {stats, wireCount, circuit, seed: stats.seed, states};
    return states;
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
 * How many of `previous`'s leading states still hold: state k holds while the first k columns are
 * time-independent and unchanged, run from the same wires, initial values and seed.
 *
 * @param {!CircuitStats} stats
 * @param {!int} wireCount
 * @param {undefined|!CircuitAlgebra} previous
 * @returns {!int}
 */
function reusableStateCount(stats, wireCount, previous) {
    const circuit = stats.circuitDefinition;
    if (previous === undefined || previous.wireCount !== wireCount || previous.seed !== stats.seed ||
            previous.circuit.numWires !== circuit.numWires ||
            !equate_Maps(previous.circuit.customInitialValues, circuit.customInitialValues)) {
        return 0;
    }
    const unchanged = circuit.columns.findIndex((column, k) =>
        column.stableDuration() !== Infinity ||
        k >= previous.circuit.columns.length ||
        !previous.circuit.columns[k].isEqualTo(column));
    // State 0 precedes every column. With every column kept, the final state is kept too.
    return (unchanged === -1 ? circuit.columns.length : unchanged) + 1;
}

/**
 * The whole circuit as a list of steps.
 *
 * States come from the simulator (stepStates), so every one is what the circuit really produces.
 * A time-independent column's operator is reused from `previous` while the column, which of its
 * gates are enabled and the inputs earlier columns set are unchanged - reading the list while a
 * time-dependent gate spins elsewhere then only rebuilds that gate's step.
 *
 * The states before the first time-dependent column do not depend on the time either, so they are
 * reused from `previous` too, while the columns before them, the wires, the initial values and the
 * seed are unchanged. A spinning gate then only reads back the states from its own column on.
 *
 * @param {!CircuitStats} stats The stats of the whole circuit.
 * @param {!int} wireCount
 * @param {undefined|!CircuitAlgebra} previous
 * @param {undefined|!StablePrefix=} prefix As for stepStates.
 * @returns {!CircuitAlgebra}
 *
 * @typedef {!{wireCount: !int, circuit: !CircuitDefinition, seed: *, states: !Array.<!Matrix>, steps: !Array.<!{
 *     column: !GateColumn, reasons: !Array.<undefined|!string>, context: !Map.<!string, *>,
 *     description: !string, structure: (undefined|!ColumnStructure), matrix: (undefined|!Matrix),
 *     reason: (undefined|!string), residual: (undefined|!number)}>}} CircuitAlgebra
 */
function circuitAlgebra(stats, wireCount, previous = undefined, prefix = undefined) {
    const circuit = stats.circuitDefinition;
    const {columns} = circuit;
    const states = stepStates(stats, wireCount, previous, prefix);

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
    return {wireCount, circuit, seed: stats.seed, states, steps};
}

export {circuitAlgebra, describeColumn, paddedState, releaseStepStates, stepStates}
