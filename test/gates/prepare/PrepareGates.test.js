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

import {Suite, assertThat} from "../../TestUtil.js"
import {Matrix} from "../../../src/engine/math/matrix/Matrix.js"
import {CircuitStats} from "../../../src/engine/simulation/CircuitStats.js"
import {circuitAlgebra, paddedState} from "../../../src/engine/simulation/stepAlgebra.js"
import {PrepareGates} from "../../../src/gates/prepare/PrepareGates.js"
import {fromJsonText_CircuitDefinition} from "../../../src/serialization/Serializer.js"

const suite = new Suite("PrepareGates");

const s = Math.SQRT1_2;

/**
 * @param {!object} json
 * @param {!int} wireCount
 * @returns {!Matrix} The state the circuit ends in, over `wireCount` wires.
 */
function finalState(json, wireCount) {
    const circuit = fromJsonText_CircuitDefinition(JSON.stringify(json));
    return paddedState(CircuitStats.fromCircuitAtTime(circuit, 0).finalState, wireCount);
}

/**
 * @param {!int} wireCount
 * @param {!Array.<!Array.<!number>>} entries [index, re, im] of each nonzero amplitude.
 * @returns {!Matrix}
 */
function ket(wireCount, entries) {
    const buffer = new Float64Array(2 << wireCount);
    for (const [index, re, im] of entries) {
        buffer[index * 2] = re;
        buffer[index * 2 + 1] = im;
    }
    return new Matrix(1, 1 << wireCount, buffer);
}

suite.testUsingWebGL("a prepare box starts its wires in the state it names", () => {
    assertThat(finalState({cols: [["PrepBell"]]}, 2)).isApproximatelyEqualTo(ket(2, [[0, s, 0], [3, s, 0]]), 1e-6);
    assertThat(finalState({cols: [["PrepGHZ3"]]}, 3)).isApproximatelyEqualTo(ket(3, [[0, s, 0], [7, s, 0]]), 1e-6);
    const t = 1 / Math.sqrt(3);
    assertThat(finalState({cols: [["PrepW3"]]}, 3)).
        isApproximatelyEqualTo(ket(3, [[1, t, 0], [2, t, 0], [4, t, 0]]), 1e-6);
    assertThat(finalState({cols: [["Prep+2"]]}, 2)).
        isApproximatelyEqualTo(ket(2, [[0, 0.5, 0], [1, 0.5, 0], [2, 0.5, 0], [3, 0.5, 0]]), 1e-6);
});

suite.testUsingWebGL("a value box starts the same as its wires' kets would", () => {
    assertThat(finalState({cols: [[{id: "Prep3", arg: 5}]]}, 3)).
        isApproximatelyEqualTo(finalState({cols: [], init: [1, 0, 1]}, 3), 1e-6);
});

suite.testUsingWebGL("boxes, kets and gates on other wires start as their product", () => {
    // |1⟩ on q0 and GHZ over q1..q3: |0001⟩ and |1111⟩.
    assertThat(finalState({cols: [[1, "PrepGHZ3"]], init: [1]}, 4)).
        isApproximatelyEqualTo(ket(4, [[1, s, 0], [15, s, 0]]), 1e-6);
});

suite.testUsingWebGL("the circuit acts on the prepared state, and the algebra starts from it", () => {
    // (|0⟩ + i|1⟩)/√2, then H: ((1 + i)|0⟩ + (1 - i)|1⟩)/2.
    const json = {cols: [[{id: "PrepPsi1", arg: [[s, 0], [0, s]]}], ["H"]]};
    assertThat(finalState(json, 1)).isApproximatelyEqualTo(ket(1, [[0, 0.5, 0.5], [1, 0.5, -0.5]]), 1e-6);

    const circuit = fromJsonText_CircuitDefinition(JSON.stringify({cols: [["PrepBell"], ["H"]]}));
    const {states, steps} = circuitAlgebra(CircuitStats.fromCircuitAtTime(circuit, 0), 2);
    assertThat(states[1]).isApproximatelyEqualTo(ket(2, [[0, s, 0], [3, s, 0]]), 1e-6);
    for (const step of steps) {
        assertThat(step.residual < 1e-5).withInfo({step: step.description, residual: step.residual}).isEqualTo(true);
    }
});

suite.testUsingWebGL("a box after a gate on its wires is disabled, so the run ignores it", () => {
    assertThat(finalState({cols: [["H"], ["Prep1"]]}, 1)).isApproximatelyEqualTo(ket(1, [[0, s, 0], [1, s, 0]]), 1e-6);
});

suite.test("a value box refuses values past its wires, and reads amplitudes as formulas", () => {
    const value = PrepareGates.ValueFamily.ofSize(2);
    assertThat(value.paramDialog.applyText(value, "3").gate.param).isEqualTo(3);
    assertThat(typeof value.paramDialog.applyText(value, "4").error).isEqualTo("string");
    assertThat(typeof value.paramDialog.applyText(value, "x").error).isEqualTo("string");

    const psi = PrepareGates.AmplitudesFamily.ofSize(1);
    assertThat(psi.paramDialog.applyText(psi, "1, i").gate.param).isApproximatelyEqualTo([[s, 0], [0, s]], 1e-9);
    assertThat(psi.paramDialog.applyText(psi, "3, 4").gate.param).isApproximatelyEqualTo([[0.6, 0], [0.8, 0]], 1e-9);
    assertThat(typeof psi.paramDialog.applyText(psi, "1").error).isEqualTo("string");
    assertThat(typeof psi.paramDialog.applyText(psi, "0, 0").error).isEqualTo("string");
    assertThat(typeof psi.paramDialog.applyText(psi, "1, tea").error).isEqualTo("string");
    // Every box declares what it prepares, for the views.
    assertThat(psi.paramDialog.applyText(psi, "1, i").gate.knownPreparation.kind).isEqualTo("amplitudes");
    assertThat(PrepareGates.Bell.knownPreparation).isEqualTo({kind: "named", name: "bell"});
});
