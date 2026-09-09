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

import {Suite, assertThat} from "../TestUtil.js"
import {decompositionOf} from "../../src/circuit/gateDecomposition.js"
import {Controls} from "../../src/gates/probes/Controls.js"
import {Gates} from "../../src/gates/AllGates.js"
import {HalfTurnGates} from "../../src/gates/rotations/HalfTurnGates.js"

const suite = new Suite("gateDecomposition");

/**
 * Runs a decomposition on one basis state, classically. Every column of these circuits is controls
 * plus one X, so a column either flips its target bit or does nothing.
 *
 * The point of the test is that what the card shows a gate "stands for" is what the gate does, so
 * this deliberately re-derives the answer from the drawn columns rather than trusting them.
 *
 * @param {!CircuitDefinition} circuit
 * @param {!int} input
 * @returns {!int}
 */
function runDecomposition(circuit, input) {
    let state = input;
    for (const column of circuit.columns) {
        let target = undefined;
        let controlsMet = true;
        for (let row = 0; row < column.gates.length; row++) {
            const gate = column.gates[row];
            if (gate === HalfTurnGates.X) {
                target = row;
            } else if (gate === Controls.Control) {
                controlsMet = controlsMet && (state & (1 << row)) !== 0;
            }
        }
        if (target !== undefined && controlsMet) {
            state ^= 1 << target;
        }
    }
    return state;
}

suite.test("increment and decrement stand for a ladder of controlled nots", () => {
    for (const span of [1, 2, 3, 4]) {
        for (const [family, step] of [[Gates.IncrementGates.IncrementFamily, +1],
                                      [Gates.IncrementGates.DecrementFamily, -1]]) {
            const gate = family.ofSize(span);
            const circuit = decompositionOf(gate);
            assertThat(circuit === undefined).isEqualTo(false);
            assertThat(circuit.numWires).isEqualTo(span);

            const mask = (1 << span) - 1;
            for (let input = 0; input <= mask; input++) {
                assertThat(runDecomposition(circuit, input)).isEqualTo((input + step) & mask);
            }
        }
    }
});

suite.test("a gate with no known decomposition reports none", () => {
    assertThat(decompositionOf(Gates.HalfTurns.X)).isEqualTo(undefined);
});
