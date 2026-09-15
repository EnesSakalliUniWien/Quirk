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
import {CircuitDefinition} from "../../../src/circuit/model/CircuitDefinition.js"
import {GateColumn} from "../../../src/circuit/model/GateColumn.js"
import {Complex} from "../../../src/engine/math/complex/Complex.js"
import {Matrix} from "../../../src/engine/math/matrix/Matrix.js"
import {blochCoordinates} from "../../../src/engine/math/bloch.js"
import {CircuitStats} from "../../../src/engine/simulation/CircuitStats.js"
import {paddedState} from "../../../src/engine/simulation/stepAlgebra.js"
import {qubitMarginals} from "../../../src/engine/simulation/qubitMarginals.js"
import {Gates} from "../../../src/gates/AllGates.js"

const suite = new Suite("qubitMarginals");

const s = Math.SQRT1_2;

/**
 * @param {!Array.<!number|!Complex>} amplitudes
 * @returns {!Matrix} The column vector with these amplitudes, in basis order.
 */
const state = (...amplitudes) => Matrix.col(...amplitudes);

const close = (actual, expected) => assertThat(actual).isApproximatelyEqualTo(expected, 1e-9);

suite.test("deferred measurement removes only the measured qubit's coherence", () => {
    // Two independent |+⟩ states, with q0 measured and q1 still coherent.
    const [q0, q1] = qubitMarginals(state(0.5, 0.5, 0.5, 0.5), 2, 1);
    close(q0.bloch.x, 0);
    close(q0.probabilityOne, 0.5);
    close(q0.purity, 0.5);
    close(q1.bloch.x, 1);
    close(q1.purity, 1);
});

suite.test("a single qubit in a basis state sits on the z axis", () => {
    const [zero] = qubitMarginals(state(1, 0), 1);
    close(zero.probabilityOne, 0);
    close(zero.bloch.z, 1);
    close(zero.purity, 1);

    const [one] = qubitMarginals(state(0, 1), 1);
    close(one.probabilityOne, 1);
    close(one.bloch.z, -1);
});

suite.test("superpositions land on the conventional x and y axes", () => {
    // The panel and the Bloch sphere panel have to agree on which way is which.
    const [plus] = qubitMarginals(state(s, s), 1);
    close(plus.bloch.x, 1);
    close(plus.bloch.y, 0);
    close(plus.probabilityOne, 0.5);

    const [plusI] = qubitMarginals(state(s, new Complex(0, s)), 1);
    close(plusI.bloch.x, 0);
    close(plusI.bloch.y, 1);
});

suite.test("each qubit of a product state is pure and read independently", () => {
    // |q1 q0> = |1>|+>: amplitudes over |00>, |01>, |10>, |11> with q0 the low bit.
    const [q0, q1] = qubitMarginals(state(0, 0, s, s), 2);
    close(q0.bloch.x, 1);
    close(q0.purity, 1);
    close(q1.probabilityOne, 1);
    close(q1.purity, 1);
});

suite.test("a Bell pair leaves each qubit maximally mixed", () => {
    for (const marginal of qubitMarginals(state(s, 0, 0, s), 2)) {
        close(marginal.purity, 0.5);
        close(marginal.probabilityOne, 0.5);
        close(Math.hypot(marginal.bloch.x, marginal.bloch.y, marginal.bloch.z), 0);
    }
});

suite.test("a post-selected, partial state is read relative to what survived", () => {
    const [q] = qubitMarginals(state(0.5, 0), 1);
    close(q.bloch.z, 1);
    close(q.purity, 1);
});

suite.test("each qubit agrees with the simulator's own density matrix for it", () => {
    // The Qubits panel and the circuit's Bloch displays must never disagree about where a qubit
    // points, so the convention is checked against the simulator rather than a formula. H then S
    // puts q0 on +y; a controlled rotation leaves q1 somewhere asymmetric and entangled.
    const H = Gates.HalfTurns.H, S = Gates.QuarterTurns.SqrtZForward;
    const circuit = new CircuitDefinition(2, [
        new GateColumn([H, H]),
        new GateColumn([S, undefined]),
        new GateColumn([Gates.Controls.Control, S]),
        new GateColumn([undefined, H]),
    ]);
    const stats = CircuitStats.fromCircuitAtTime(circuit, 0);
    const marginals = qubitMarginals(paddedState(stats.finalState, 2), 2);
    for (let wire = 0; wire < 2; wire++) {
        const expected = blochCoordinates(stats.qubitDensityMatrix(Infinity, wire));
        assertThat(marginals[wire].bloch.x).isApproximatelyEqualTo(expected.x, 1e-4);
        assertThat(marginals[wire].bloch.y).isApproximatelyEqualTo(expected.y, 1e-4);
        assertThat(marginals[wire].bloch.z).isApproximatelyEqualTo(expected.z, 1e-4);
    }
});
