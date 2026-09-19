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
import {CircuitStats} from "../../../src/engine/simulation/CircuitStats.js"
import {Complex} from "../../../src/engine/math/complex/Complex.js"
import {Matrix} from "../../../src/engine/math/matrix/Matrix.js"
import {Gates} from "../../../src/gates/AllGates.js"
import {ArithmeticGates} from "../../../src/gates/arithmetic/ArithmeticGates.js"
import {circuitAlgebra, describeColumn, paddedState} from "../../../src/engine/simulation/stepAlgebra.js"

const suite = new Suite("stepAlgebra");

const H = Gates.HalfTurns.H;
const X = Gates.HalfTurns.X;
const C = Gates.Controls.Control;
const s = Math.SQRT1_2;

/**
 * @param {!int} wires
 * @param {...!Array.<undefined|!Gate>} columns
 * @returns {!CircuitDefinition}
 */
const circuitOf = (wires, ...columns) =>
    new CircuitDefinition(wires, columns.map(gates => new GateColumn(gates)));

/**
 * @param {!CircuitDefinition} circuit
 * @param {undefined|!CircuitAlgebra} previous
 * @returns {!CircuitAlgebra}
 */
const algebraOf = (circuit, previous = undefined) =>
    circuitAlgebra(CircuitStats.fromCircuitAtTime(circuit, 0), circuit.numWires, previous);

/**
 * @param {!Matrix} matrix
 * @param {!int} row
 * @param {!int} col
 * @returns {!Array.<!number>} The entry's real and imaginary parts.
 */
const entry = (matrix, row, col) => {
    const k = (row * matrix.width() + col) * 2;
    return [matrix.rawBuffer()[k], matrix.rawBuffer()[k + 1]];
};

suite.test("a step's matrix is its column's operator", () => {
    assertThat(algebraOf(circuitOf(1, [H])).steps[0].matrix).
        isApproximatelyEqualTo(Matrix.square(s, s, s, -s), 1e-6);

    // Control on q0 and X on q1 is CNOT with q0 the low bit: it swaps |01> and |11>.
    assertThat(algebraOf(circuitOf(2, [C, X])).steps[0].matrix).
        isApproximatelyEqualTo(Matrix.fromRows([
            [1, 0, 0, 0],
            [0, 0, 0, 1],
            [0, 0, 1, 0],
            [0, 1, 0, 0],
        ]), 1e-6);

    // An empty column changes nothing.
    assertThat(algebraOf(circuitOf(2, [undefined, undefined])).steps[0].matrix).
        isApproximatelyEqualTo(Matrix.identity(4), 1e-6);
});

suite.test("the list has every state and every step, and each matrix checks out", () => {
    // H, then CNOT, then a Z on the target: a Bell pair with a phase.
    const circuit = circuitOf(2, [H, undefined], [C, X], [undefined, Gates.HalfTurns.Z]);
    const {states, steps} = circuitAlgebra(CircuitStats.fromCircuitAtTime(circuit, 0), 2);
    assertThat(states.length).isEqualTo(4);
    assertThat(steps.length).isEqualTo(3);
    assertThat(states[0]).isApproximatelyEqualTo(Matrix.col(1, 0, 0, 0), 1e-6);
    assertThat(states[3]).isApproximatelyEqualTo(Matrix.col(s, 0, 0, -s), 1e-6);
    for (const step of steps) {
        assertThat(step.reason).isEqualTo(undefined);
        // This is the check the panel shows the user; it has to hold for real circuits.
        assertThat(step.residual < 1e-5).isEqualTo(true);
        // And each matrix really is the step: it takes the state before to the state after.
        assertThat(step.matrix.times(states[steps.indexOf(step)])).
            isApproximatelyEqualTo(states[steps.indexOf(step) + 1], 1e-5);
    }
});

suite.test("an unchanged time-independent column keeps its matrix", () => {
    const circuit = circuitOf(2, [H, undefined], [C, X]);
    const first = circuitAlgebra(CircuitStats.fromCircuitAtTime(circuit, 0), 2);
    const edited = circuit.withColumns([...circuit.columns, new GateColumn([undefined, H])]);
    const second = circuitAlgebra(CircuitStats.fromCircuitAtTime(edited, 0), 2, first);
    // Reused, not recomputed: the same object, not merely an equal one.
    assertThat(second.steps[0].matrix === first.steps[0].matrix).isEqualTo(true);
    assertThat(second.steps[1].matrix === first.steps[1].matrix).isEqualTo(true);
    assertThat(second.steps.length).isEqualTo(3);
});

suite.test("the states before the first time-dependent column are kept while time moves", () => {
    const spin = Gates.Powering.XForward;
    const circuit = circuitOf(2, [H, undefined], [C, X], [spin, undefined], [undefined, H]);
    const first = circuitAlgebra(CircuitStats.fromCircuitAtTime(circuit, 0.125), 2);
    const second = circuitAlgebra(CircuitStats.fromCircuitAtTime(circuit, 0.25), 2, first);
    // Reused, not recomputed: the same objects, up to the state the spinning column starts from.
    for (const k of [0, 1, 2]) {
        assertThat(second.states[k] === first.states[k]).withInfo({k}).isEqualTo(true);
    }
    // From the spinning column on, every state is the simulator's at the new time.
    const fresh = circuitAlgebra(CircuitStats.fromCircuitAtTime(circuit, 0.25), 2);
    for (const k of [3, 4]) {
        assertThat(second.states[k] === first.states[k]).withInfo({k}).isEqualTo(false);
        assertThat(second.states[k]).withInfo({k}).isApproximatelyEqualTo(fresh.states[k], 0.0001);
    }
    assertThat(second.states[3]).isNotApproximatelyEqualTo(first.states[3], 0.0001);
});

suite.test("an edited column, another seed or other wires drop the states that depended on them", () => {
    const circuit = circuitOf(2, [H, undefined], [C, X]);
    const first = circuitAlgebra(CircuitStats.fromCircuitAtTime(circuit, 0, "a"), 2);
    const edited = circuit.withColumns([circuit.columns[0], new GateColumn([undefined, X])]);
    const second = circuitAlgebra(CircuitStats.fromCircuitAtTime(edited, 0, "a"), 2, first);
    assertThat(second.states[1] === first.states[1]).isEqualTo(true);
    assertThat(second.states[2] === first.states[2]).isEqualTo(false);
    const reseeded = circuitAlgebra(CircuitStats.fromCircuitAtTime(circuit, 0, "b"), 2, first);
    assertThat(reseeded.states[0] === first.states[0]).isEqualTo(false);
    const widened = circuitAlgebra(CircuitStats.fromCircuitAtTime(circuit, 0, "a"), 3, first);
    assertThat(widened.states[0] === first.states[0]).isEqualTo(false);
});

suite.test("a column is described by what acts where, and on what condition", () => {
    const text = describeColumn(new GateColumn([C, X]));
    assertThat(text.includes(X.name + " on q1")).isEqualTo(true);
    assertThat(text.includes("if q0 is")).isEqualTo(true);
    assertThat(describeColumn(new GateColumn([undefined, undefined]))).isEqualTo("Nothing - the identity");
});

suite.test("a column reads the inputs an earlier column set, and follows them when they change", () => {
    // Set A in the first column; the second adds A into q2..q3.
    const plusA = ArithmeticGates.PlusAFamily.ofSize(2);
    const circuitWith = a => circuitOf(4,
        [Gates.InputGates.SetA.withParam(a), undefined, undefined, undefined],
        [undefined, undefined, plusA, undefined]);
    const first = algebraOf(circuitWith(1));
    // A = 1 lands in q2: |0000> goes to |0100>.
    assertThat(entry(first.steps[1].matrix, 4, 0)).isApproximatelyEqualTo([1, 0], 1e-9);
    assertThat(first.steps[1].residual < 1e-5).isEqualTo(true);

    // The column is unchanged, but what it reads is not: its operator must not be reused.
    const second = algebraOf(circuitWith(2), first);
    assertThat(second.steps[1].matrix === first.steps[1].matrix).isEqualTo(false);
    assertThat(entry(second.steps[1].matrix, 8, 0)).isApproximatelyEqualTo([1, 0], 1e-9);
});

suite.test("past a dense matrix's size every step still has its operator, checked against the simulation", () => {
    const wide = (...gates) => [...gates, ...Array(10 - gates.length).fill(undefined)];
    const circuit = circuitOf(10, wide(H), [C, ...Array(8).fill(undefined), X], wide(Gates.IncrementGates.IncrementFamily.ofSize(3)));
    const {steps} = algebraOf(circuit);
    for (const step of steps) {
        assertThat(step.structure === undefined).withInfo({reason: step.reason}).isEqualTo(false);
        assertThat(step.matrix).isEqualTo(undefined);
        assertThat(step.residual < 1e-5).withInfo({residual: step.residual}).isEqualTo(true);
    }
});

suite.test("a short simulated state is padded with the untouched wires' zeros", () => {
    const padded = paddedState(Matrix.col(s, new Complex(0, s)), 2);
    assertThat(padded).isApproximatelyEqualTo(Matrix.col(s, new Complex(0, s), 0, 0), 1e-12);
});
