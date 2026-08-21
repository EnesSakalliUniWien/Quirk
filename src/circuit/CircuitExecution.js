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

import {CircuitShaders} from "./CircuitShaders.js"
import {DetailedError} from "../base/DetailedError.js"
import {GateShaders} from "./GateShaders.js"
import {Gates, INITIAL_STATES_TO_GATES} from "../gates/AllGates.js"

/**
 * @param {!CircuitDefinition} circuit
 * @param {!CircuitEvalContext} ctx
 * @return {void}
 */
function applyInitialStateOperations(circuit, ctx) {
    for (let wire = 0; wire < circuit.numWires; wire++) {
        let state = circuit.customInitialValues.get(wire);
        if (!INITIAL_STATES_TO_GATES.has(state)) {
            throw new DetailedError('Unrecognized initial state.', {state});
        }
        for (let gate of INITIAL_STATES_TO_GATES.get(state)) {
            GateShaders.applyMatrixOperation(ctx.withRow(ctx.row + wire), gate.knownMatrixAt(ctx.time))
        }
    }
}

/**
 * @param {!CircuitDefinition} circuit
 * @param {!int} colIndex
 * @param {!CircuitEvalContext} ctx
 * @return {void}
 */
function applyMainOperationsInCol(circuit, colIndex, ctx) {
    if (colIndex < 0 || colIndex >= circuit.columns.length) {
        return;
    }

    applyOpsInCol(circuit, colIndex, ctx, gate => {
        if (gate.definitelyHasNoEffect() || gate === Gates.Special.SwapHalf) {
            return undefined;
        }

        if (gate.customOperation !== undefined) {
            return gate.customOperation;
        }

        return ctx => GateShaders.applyMatrixOperation(ctx, gate.knownMatrixAt(ctx.time));
    });

    let swapRows = circuit.colGetEnabledSwapGate(colIndex);
    if (swapRows !== undefined) {
        let [i, j] = swapRows;
        ctx.applyOperation(CircuitShaders.swap(ctx.withRow(i + ctx.row), j + ctx.row));
    }
}

/**
 * @param {!CircuitDefinition} circuit
 * @param {!int} colIndex
 * @param {!CircuitEvalContext} ctx
 * @return {void}
 */
function applyBeforeOperationsInCol(circuit, colIndex, ctx) {
    applyOpsInCol(circuit, colIndex, ctx, g => g.customBeforeOperation);
}

/**
 * @param {!CircuitDefinition} circuit
 * @param {!int} colIndex
 * @param {!CircuitEvalContext} ctx
 * @return {void}
 */
function applyAfterOperationsInCol(circuit, colIndex, ctx) {
    applyOpsInCol(circuit, colIndex, ctx, g => g.customAfterOperation);
}

/**
 * @param {!CircuitDefinition} circuit
 * @param {!int} colIndex
 * @param {!CircuitEvalContext} ctx
 * @param {!function(!Gate) : !function(!CircuitEvalContext)} opGetter
 */
function applyOpsInCol(circuit, colIndex, ctx, opGetter) {
    if (colIndex < 0 || colIndex >= circuit.columns.length) {
        return;
    }
    let col = circuit.columns[colIndex];

    for (let row = 0; row < circuit.numWires; row++) {
        let gate = col.gates[row];
        if (gate === undefined || circuit.gateAtLocIsDisabledReason(colIndex, row) !== undefined) {
            continue;
        }

        let op = opGetter(gate);
        if (op !== undefined) {
            op(ctx.withRow(ctx.row + row));
        }
    }
}

export {
    applyInitialStateOperations,
    applyMainOperationsInCol,
    applyBeforeOperationsInCol,
    applyAfterOperationsInCol,
}
