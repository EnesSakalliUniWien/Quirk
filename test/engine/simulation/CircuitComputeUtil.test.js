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

import {Suite} from "../../TestUtil.js"
import {CircuitDefinition} from "../../../src/circuit/model/CircuitDefinition.js"
import {setGateBuilderEffectToCircuit, advanceStateWithCircuit} from "../../../src/engine/simulation/CircuitComputeUtil.js"
import {assertThatCircuitUpdateActsLikeMatrix} from "../../CircuitOperationTestUtil.js"
import {GateBuilder} from "../../../src/circuit/model/Gate.js"

import {Controls} from "../../../src/circuit/model/Controls.js"
import {Gates} from "../../../src/gates/AllGates.js"
import {Matrix} from "../../../src/engine/math/matrix/Matrix.js"
import {expandedForQubitInRegister} from "../../MatrixTestUtil.js"
import {QubitMatrix} from "../../../src/engine/math/matrix/QubitMatrix.js"

const suite = new Suite("CircuitComputeUtil");

/**
 * @param {!String} diagram
 * @param {!Array.<*>} extras
 */
const circuit = (diagram, ...extras) => CircuitDefinition.fromTextDiagram(new Map([
    ['X', Gates.HalfTurns.X],
    ['Y', Gates.HalfTurns.Y],
    ['Z', Gates.HalfTurns.Z],
    ['H', Gates.HalfTurns.H],
    ['•', Gates.Controls.Control],
    ['a', Gates.InputGates.InputAFamily.ofSize(1)],
    ['b', Gates.InputGates.InputBFamily.ofSize(1)],
    ['*', Gates.MultiplyAccumulateGates.MultiplyAddInputsFamily.ofSize(1)],
    ['-', undefined],
    ['/', undefined],
    ...extras
]), diagram);

/**
 * @param {!CircuitDefinition} circ
 * @returns {!Gate}
 */
function circuitDefinitionToGate(circ) {
    return setGateBuilderEffectToCircuit(new GateBuilder(), circ).gate;
}

suite.testUsingWebGL("nestedControls", () => {
    const cnot = circuitDefinitionToGate(circuit(`-•-
                                                -X-`));
    const ccnot_circuit = circuit(`-•-
                                 -?-
                                 -/-`, ['?', cnot]);
    const ccnot_matrix = expandedForQubitInRegister(QubitMatrix.PAULI_X, 2, 3, new Controls(3, 3));
    assertThatCircuitUpdateActsLikeMatrix(
        ctx => advanceStateWithCircuit(ctx, ccnot_circuit, false),
        ccnot_matrix);
});

suite.testUsingWebGL("multiNestedControls", () => {
    const notc = circuitDefinitionToGate(circuit(`-X-
                                                -•-`));
    const i_notcc = circuitDefinitionToGate(circuit(`---
                                                   -?-
                                                   -/-
                                                   -•-`, ['?', notc]));
    const shifted_notccc_circuit = circuit(`---
                                          -?-
                                          -/-
                                          -/-
                                          -/-
                                          -•-`, ['?', i_notcc]);
    const shifted_notccc_matrix = expandedForQubitInRegister(QubitMatrix.PAULI_X, 2, 6, new Controls(7<<3, 7<<3));
    assertThatCircuitUpdateActsLikeMatrix(
        ctx => advanceStateWithCircuit(ctx, shifted_notccc_circuit, false),
        shifted_notccc_matrix);
});

suite.testUsingWebGL("innerAndOuterInputs", () => {
    const plus_a_times = circuitDefinitionToGate(circuit(`-*-
                                                        -a-`));
    const notcc_circuit = circuit(`-?-
                                 -/-
                                 -b-`, ['?', plus_a_times]);
    const notcc_matrix = expandedForQubitInRegister(QubitMatrix.PAULI_X, 0, 3, new Controls(6, 6));
    assertThatCircuitUpdateActsLikeMatrix(
        ctx => advanceStateWithCircuit(ctx, notcc_circuit, false),
        notcc_matrix);
});

suite.testUsingWebGL("doublyNestedInputs", () => {
    const plus_a_times = circuitDefinitionToGate(circuit(`-*-
                                                        -a-`));
    const plus_a_times_b = circuitDefinitionToGate(circuit(`-?-
                                                          -/-
                                                          -b-`, ['?', plus_a_times]));
    const shifted_notcc_circuit = circuit(`---
                                         -?-
                                         -/-
                                         -/-`, ['?', plus_a_times_b]);
    const shifted_notcc_matrix = expandedForQubitInRegister(QubitMatrix.PAULI_X, 1, 4, new Controls(12, 12));
    assertThatCircuitUpdateActsLikeMatrix(
        ctx => advanceStateWithCircuit(ctx, shifted_notcc_circuit, false),
        shifted_notcc_matrix);
});

suite.testUsingWebGL("rawAddition", () => {
    const adder = circuit(`-+-
                         -/-
                         -/-
                         -/-
                         -A-
                         -/-`,
        ['A', Gates.InputGates.InputAFamily.ofSize(2)],
        ['+', Gates.Arithmetic.PlusAFamily.ofSize(4)]);
    const matrix = Matrix.generateTransition(1 << 6, e => {
        let a = e & 15;
        const b = (e >> 4) & 3;
        a += b;
        a &= 15;
        return a | (b << 4);
    });
    assertThatCircuitUpdateActsLikeMatrix(
        ctx => advanceStateWithCircuit(ctx, adder, false),
        matrix);
});


suite.testUsingWebGL('swap', () => {
    const circ = circuit(`-S-
                        -S-`, ['S', Gates.Special.SwapHalf]);
    assertThatCircuitUpdateActsLikeMatrix(
        ctx => advanceStateWithCircuit(ctx, circ, false),
        Gates.Special.SwapHalf.knownMatrixAt(0));
});
