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

import {assertThat, Suite} from "../../TestUtil.js"
import {CircuitDefinition} from "../../../src/circuit/model/CircuitDefinition.js"
import {CircuitStats} from "../../../src/engine/simulation/CircuitStats.js"
import {Gates} from "../../../src/gates/AllGates.js"
import {Util} from "../../../src/base/Util.js"

let suite = new Suite("InputGates");

const TEST_GATES = new Map([
    ['$', Gates.ModularIncrementGates.DecrementModRFamily],
    ['*', Gates.MultiplyAccumulateGates.MultiplyAddInputsFamily],
    ['X', Gates.HalfTurns.X],
    ['⊕', Gates.XorGates.XorAFamily],
    ['A', Gates.InputGates.InputAFamily],
    ['B', Gates.InputGates.InputBFamily],
    ['R', Gates.InputGates.InputRFamily],
    ['∀', Gates.InputGates.InputRevAFamily],
    ['ᗺ', Gates.InputGates.InputRevBFamily],
    ['-', undefined],
    ['/', null],
]);
const circuit = (diagram, ...extraGates) => CircuitDefinition.fromTextDiagram(
    Util.mergeMaps(TEST_GATES, new Map(extraGates)),
    diagram);

suite.testUsingWebGL('endianness', () => {
    let output = diagram => {
        let stats = CircuitStats.fromCircuitAtTime(circuit(diagram), 0);
        let solo = Array.from({length: stats.finalState.height()}, (_, i) => i).
            filter(i => stats.finalState.cell(0, i).isEqualTo(1));
        if (solo.length === 0) {
            throw new Error("Empty sequence has no first item.");
        }
        return solo[0];
    };

    assertThat(output(`-X-A-
                       ---/-
                       ---/-
                       -----
                       ---⊕-
                       ---/-
                       ---/-`)).isEqualTo(0b0010001);

    assertThat(output(`-X-∀-
                       ---/-
                       ---/-
                       -----
                       ---⊕-
                       ---/-
                       ---/-`)).isEqualTo(0b1000001);

    assertThat(output(`---$-
                       ---/-
                       ---/-
                       ---/-
                       -X-R-
                       -X-/-
                       ---/-
                       -X-/-`)).isEqualTo(0b10111010);

    assertThat(output(`---*-
                       ---/-
                       -X-A-
                       -X-B-
                       ---/-`)).isEqualTo(0b01101);

    assertThat(output(`---*-
                       ---/-
                       -X-A-
                       -X-ᗺ-
                       ---/-`)).isEqualTo(0b01110);
});
