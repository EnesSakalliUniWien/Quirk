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

import {CircuitDefinition} from "../../../src/circuit/model/CircuitDefinition.js"
import {GateColumn} from "../../../src/circuit/model/GateColumn.js"
import {Matrix} from "../../../src/engine/math/matrix/Matrix.js"
import {CircuitStats} from "../../../src/engine/simulation/CircuitStats.js"
import {paddedState} from "../../../src/engine/simulation/stepAlgebra.js"

/**
 * The matrix of one column read off the engine itself: the column alone, run on every basis state,
 * each run's output one column of the matrix. One simulation per basis state makes it an oracle
 * for small registers in tests, not something the app runs.
 *
 * The column is run on its own, so it must not read inputs an earlier column set.
 *
 * @param {!CircuitDefinition} circuit
 * @param {!int} colIndex
 * @param {!int} wireCount
 * @param {!number} time
 * @returns {!Matrix}
 */
function engineColumnOperator(circuit, colIndex, wireCount, time) {
    const gates = circuit.columns[colIndex].gates;
    const column = new GateColumn(Array.from({length: wireCount}, (_, row) => gates[row]));
    const size = 1 << wireCount;
    const buffer = new Float64Array(size * size * 2);
    for (let basis = 0; basis < size; basis++) {
        const initialValues = new Map();
        for (let bit = 0; bit < wireCount; bit++) {
            if ((basis & (1 << bit)) !== 0) {
                initialValues.set(bit, "1");
            }
        }
        const alone = new CircuitDefinition(
            wireCount, [column], 0, new Map(), circuit.customGateSet, false, initialValues);
        const output = paddedState(CircuitStats.fromCircuitAtTime(alone, time).finalState, wireCount).rawBuffer();
        for (let row = 0; row < size; row++) {
            buffer[(row * size + basis) * 2] = output[row * 2];
            buffer[(row * size + basis) * 2 + 1] = output[row * 2 + 1];
        }
    }
    return new Matrix(size, size, buffer);
}

export {engineColumnOperator}
