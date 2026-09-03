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
import {CircuitDefinition} from "../../src/circuit/CircuitDefinition.js"
import {CircuitStats} from "../../src/circuit/CircuitStats.js"
import {Gates} from "../../src/gates/AllGates.js"
import {stateTableRows} from "../../src/app/stateTable.js"

let suite = new Suite("stateTable");

const circuit = diagram => CircuitDefinition.fromTextDiagram(new Map([
    ['H', Gates.HalfTurns.H],
    ['X', Gates.HalfTurns.X],
    ['Z', Gates.HalfTurns.Z],
    ['-', undefined]
]), diagram);

suite.test("lists the nonzero amplitudes of the output state", () => {
    let stats = CircuitStats.fromCircuitAtTime(circuit(`H-
                                                        -X`), 0);

    let {amplitudeCount, nonzeroCount, rows} = stateTableRows(stats, 2);

    assertThat(amplitudeCount).isEqualTo(4);
    assertThat(nonzeroCount).isEqualTo(2);
    assertThat(rows.map(e => e.ket)).isEqualTo(['10', '11']);
    assertThat(rows.map(e => e.probability)).isApproximatelyEqualTo([0.5, 0.5], 0.001);
    assertThat(rows.map(e => e.real)).isApproximatelyEqualTo([Math.sqrt(0.5), Math.sqrt(0.5)], 0.001);
    assertThat(rows.map(e => e.imag)).isApproximatelyEqualTo([0, 0], 0.001);
});

suite.test("reports the phase of each amplitude in degrees", () => {
    let stats = CircuitStats.fromCircuitAtTime(circuit(`HZ
                                                        -X`), 0);

    let rows = stateTableRows(stats, 2).rows;

    assertThat(rows.map(e => e.ket)).isEqualTo(['10', '11']);
    assertThat(rows.map(e => e.real)).isApproximatelyEqualTo([Math.sqrt(0.5), -Math.sqrt(0.5)], 0.001);
    assertThat(rows.map(e => Math.abs(e.phaseDegrees))).isApproximatelyEqualTo([0, 180], 0.001);
});

suite.test("caps the rows without hiding how many there are", () => {
    let stats = CircuitStats.fromCircuitAtTime(circuit(`H-
                                                        -H`), 0);

    let {nonzeroCount, rows} = stateTableRows(stats, 2, 3);

    assertThat(nonzeroCount).isEqualTo(4);
    assertThat(rows.length).isEqualTo(3);
    assertThat(rows.map(e => e.ket)).isEqualTo(['00', '01', '10']);
});

suite.test("a circuit that failed to simulate has no nonzero amplitudes", () => {
    let stats = CircuitStats.withNanDataFromCircuitAtTime(circuit(`H-
                                                                   -X`), 0);

    let {amplitudeCount, nonzeroCount, rows} = stateTableRows(stats, 2);

    assertThat(amplitudeCount).isEqualTo(4);
    assertThat(nonzeroCount).isEqualTo(0);
    assertThat(rows).isEqualTo([]);
});

suite.test("pads out wires the simulator dropped because no gate touched them", () => {
    // Only wire 0 carries a gate, so the simulator returns a one-qubit state for a two-wire circuit.
    let stats = CircuitStats.fromCircuitAtTime(circuit(`X-
                                                        --`), 0);

    let {amplitudeCount, nonzeroCount, rows} = stateTableRows(stats, 2);

    assertThat(amplitudeCount).isEqualTo(4);
    assertThat(nonzeroCount).isEqualTo(1);
    assertThat(rows.map(e => e.ket)).isEqualTo(['01']);
});
