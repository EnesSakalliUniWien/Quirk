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
import {BitCountGates} from "../../../src/gates/arithmetic/BitCountGates.js"
import {InputGates} from "../../../src/gates/inputs/InputGates.js"
import {assertThatCircuitUpdateActsLikeMatrix} from "../../CircuitOperationTestUtil.js"
import {advanceStateWithCircuit} from "../../../src/engine/simulation/CircuitComputeUtil.js"

import {CircuitDefinition} from "../../../src/circuit/model/CircuitDefinition.js"
import {Matrix} from "../../../src/engine/math/matrix/Matrix.js"
import { numberOfSetBits } from "../../../src/engine/math/bitOperations.js";

const suite = new Suite("BitCountGates");

const GATE_SET = new Map([
    ['A', InputGates.InputAFamily],
    ['-', undefined],
    ['/', null],
    ['P', BitCountGates.PlusBitCountAFamily],
    ['M', BitCountGates.MinusBitCountAFamily]
]);

suite.testUsingWebGL('PlusBitCountA', () => {
    assertThatCircuitUpdateActsLikeMatrix(
        ctx => advanceStateWithCircuit(
            ctx,
            CircuitDefinition.fromTextDiagram(GATE_SET,
                `-A-
                 -/-
                 -/-
                 -P-
                 -/-`),
            false),
        Matrix.generateTransition(1<<5, i => {
            const a = i & 7;
            let t = (i >> 3) & 3;
            t += numberOfSetBits(a);
            t &= 3;
            return a | (t << 3);
        }));
});

suite.testUsingWebGL('MinusBitCountA', () => {
    assertThatCircuitUpdateActsLikeMatrix(
            ctx => advanceStateWithCircuit(
            ctx,
            CircuitDefinition.fromTextDiagram(GATE_SET,
                `-A-
                 -/-
                 -/-
                 -M-
                 -/-`),
            false),
        Matrix.generateTransition(1<<5, i => {
            const a = i & 7;
            let t = (i >> 3) & 3;
            t -= numberOfSetBits(a);
            t &= 3;
            return a | (t << 3);
        }));
});
