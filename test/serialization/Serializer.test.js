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

import {Suite, assertThat, assertThrows, assertTrue} from "../TestUtil.js"
import {Serializer} from "../../src/serialization/Serializer.js"

import {CircuitDefinition} from "../../src/circuit/model/CircuitDefinition.js"
import {Registers} from "../../src/circuit/model/Registers.js"
import {setGateBuilderEffectToCircuit} from "../../src/engine/simulation/CircuitComputeUtil.js"
import {Complex} from "../../src/engine/math/complex/Complex.js"
import {CustomGateSet} from "../../src/circuit/model/CustomGateSet.js"
import {describe} from "../../src/base/Describe.js"
import {Gate, GateBuilder} from "../../src/circuit/model/Gate.js"
import {GateColumn} from "../../src/circuit/model/GateColumn.js"
import {Gates} from "../../src/gates/AllGates.js"
import {Matrix} from "../../src/engine/math/matrix/Matrix.js"
import {MysteryGateMaker} from "../../src/gates/misc/Joke_MysteryGate.js"
import {Util} from "../../src/base/Util.js"

const suite = new Suite("Serializer");

const assertRoundTrip = (t, v, s, equater=undefined) => {
    try {
        const from = Serializer.fromJson(t, s);
        const to = Serializer.toJson(v);
        if (equater === undefined) {
            assertThat(from).isEqualTo(v);
            assertThat(to).isEqualTo(s);
        } else {
            assertThat(equater(from, v)).isEqualTo(true);
            assertThat(equater(to, s)).isEqualTo(true);
        }
    } catch (failure) {
        console.error(`Failed to round-trip: ${describe(s)} <--> ${describe(v)}`);
        throw failure;
    }
};

suite.test("roundTrip_Complex", () => {
    assertRoundTrip(Complex, Complex.ONE, "1");
    assertRoundTrip(Complex, new Complex(2, -3), "2-3i");
    assertRoundTrip(Complex, Complex.I, "i");
    assertRoundTrip(Complex, new Complex(0, -1), "-i");
    assertRoundTrip(Complex, new Complex(1 / 3, 0), "\u2153");
    assertRoundTrip(Complex, new Complex(1 / 3 + 0.00001, 0), "0.3333433333333333");
});

suite.test("roundTrip_Matrix", () => {
    assertRoundTrip(Matrix, Matrix.fromRows([[1, Complex.I]]), "{{1,i}}");
    assertRoundTrip(Matrix, Matrix.col(1, Complex.I), "{{1},{i}}");
    assertRoundTrip(Matrix, Matrix.square(1 / 3 + 0.00001, Complex.I.plus(1), -1 / 3, 0),
        "{{0.3333433333333333,1+i},{-\u2153,0}}");
});

suite.test("roundTrip_Gate", () => {
    assertRoundTrip(Gate, Gates.HalfTurns.X, "X", Util.STRICT_EQUALITY);
    for (const g of Gates.KnownToSerializer) {
        assertRoundTrip(Gate, g, g.serializedId, Util.STRICT_EQUALITY);
    }

    const f = MysteryGateMaker();
    const f2 = Serializer.fromJson(Gate, Serializer.toJson(f));
    assertThat(f.name).isEqualTo(f2.name);
    assertThat(f.blurb).isEqualTo(f2.blurb);
    assertThat(f.knownMatrixAt(0)).isEqualTo(f2.knownMatrixAt(0));
    assertThat(f.serializedId).isEqualTo(f2.serializedId);

    const g = Gate.fromKnownMatrix(
        "custom_id",
        Matrix.square(Complex.I, -1, 2, 3),
        "custom_name",
        "custom_blurb");
    const v = Serializer.toJson(g);
    const g2 = Serializer.fromJson(Gate, v);
    assertThat(v).isEqualTo({id: "custom_id", matrix: "{{i,-1},{2,3}}"});
    assertThat(g.knownMatrixAt(0)).isEqualTo(g2.knownMatrixAt(0));
    assertThat(g.symbol).isEqualTo(g2.symbol);
});

suite.test("roundTrip_CircuitDefinitionWithCustomGate", () => {
    const customGate = new GateBuilder().
        setSerializedId("~test").
        setSymbol('sym').
        setTitle('nam').
        setBlurb('blur').
        setKnownEffectToMatrix(Matrix.square(2, 3, 5, 7)).
        gate;
    const circuit = new CircuitDefinition(
        2,
        [new GateColumn([undefined, customGate])],
        undefined,
        undefined,
        new CustomGateSet(customGate));

    const json = Serializer.toJson(circuit);
    assertThat(json).isEqualTo({
        cols: [[1, '~test']],
        gates: [{id: '~test', name: 'sym', matrix: '{{2,3},{5,7}}'}]
    });

    const circuit2 = Serializer.fromJson(CircuitDefinition, json);
    assertThat(circuit2.columns.length).isEqualTo(1);
    assertThat(circuit2.columns[0].gates.length).isEqualTo(2);
    assertThat(circuit2.columns[0].gates[0]).isEqualTo(undefined);
    assertThat(circuit2.columns[0].gates[1].matrix).isEqualTo(customGate.matrix);
    assertThat(circuit2.columns[0].gates[1].symbol).isEqualTo(customGate.symbol);
    assertThat(circuit2.columns[0].gates[1].serializedId).isEqualTo(customGate.serializedId);
    assertThat(circuit2.customGateSet.gates.length).isEqualTo(1);
    assertTrue(circuit2.customGateSet.gates[0] === circuit2.columns[0].gates[1]);
});

suite.test("roundTrip_CircuitDefinitionWithDependentCustomGates", () => {
    const customGate = new GateBuilder().
        setSerializedId("~test").
        setSymbol('sym').
        setTitle('nam').
        setBlurb('blur').
        setKnownEffectToMatrix(Matrix.square(2, 3, 5, 7)).
        gate;
    const circuitForGate = new CircuitDefinition(
        2,
        [new GateColumn([customGate, customGate])],
        undefined,
        undefined,
        new CustomGateSet(customGate));
    const circuitGate = setGateBuilderEffectToCircuit(new GateBuilder(), circuitForGate).
        setSerializedId("~wombo").
        setSymbol('combo').
        gate;

    const circuit = new CircuitDefinition(
        3,
        [new GateColumn([customGate, circuitGate, undefined])],
        undefined,
        undefined,
        new CustomGateSet(customGate, circuitGate));

    const json = Serializer.toJson(circuit);
    assertThat(json).isEqualTo({
        cols: [['~test', '~wombo']], gates: [
            {id: '~test', name: 'sym', matrix: '{{2,3},{5,7}}'},
            {id: '~wombo', name: 'combo', circuit: {cols:[['~test', '~test']]}}]
    });
});

suite.test("roundTrip_GateColumn", () => {
    assertRoundTrip(
        GateColumn,
        new GateColumn([
            undefined,
            Gates.HalfTurns.X,
            Gates.Powering.XForward,
            Gates.Special.SwapHalf,
            Gates.Controls.Control,
            undefined]),
        [1, "X", "X^t", "Swap", "\u2022", 1]);
});

suite.test("roundTrip_circuitDefinition", () => {
    assertRoundTrip(
        CircuitDefinition,
        new CircuitDefinition(
            3,
            [new GateColumn([undefined, undefined, Gates.HalfTurns.X])]),
        {cols: [[1, 1, "X"]]});
});

suite.test("retired arithmetic ids are not registered", () => {
    const context = new CustomGateSet();
    for (let span = 2; span <= 16; span++) {
        for (const prefix of ['add', 'sub', 'c+=ab', 'c-=ab']) {
            assertThat(Gates.findKnownGateById(prefix + span, context)).isEqualTo(undefined);
        }
    }
});

suite.test("parse_nested_circuits", () => {
    const json = {
        cols:[["H"],["•","X"],["~oc3t"],["~qoc2"]],
        gates:[
            {
                id:"~oc3t",
                circuit:{cols:[["H"],["•","X"]]}},
            {
                id:"~v9rj",
                circuit:{cols:[["H"],["•","X"],["~oc3t"]]}
            },
            {
                id:"~qoc2",
                circuit:{"cols":[["H"],["•","X"],["~oc3t"]]}
            }
        ]
    };

    const circuitDef = Serializer.fromJson(CircuitDefinition, json);
    const reJson = Serializer.toJson(circuitDef);
    assertThat(JSON.stringify(reJson)).isEqualTo(JSON.stringify(json));
});

suite.test("known_gates_toolbox", () => {
    const allToolboxGates = [...Gates.TopToolboxGroups, ...Gates.BottomToolboxGroups].
        flatMap(e => e.gates).
        flatMap(e => e.gateFamily);

    const knownIds = new Set(Gates.KnownToSerializer.map(e => e.serializedId));
    knownIds.add(MysteryGateMaker().serializedId);
    for (const gate of allToolboxGates) {
        assertThat(knownIds.has(gate.serializedId)).withInfo(gate).isEqualTo(true);
    }

    // Print 'hidden ids' of gates not accessible from toolbox
    //let toolboxIds = new Set(allToolboxGates.map(e => e.serializedId));
    //for (let id of knownIds) {
    //    if (!toolboxIds.has(id)) {
    //        console.warn("hidden id: " + id);
    //    }
    //}
});

suite.test("roundTrip_circuitDefinitionWithRegisters", () => {
    const registers = new Registers([
        {name: "a", start: 0, length: 3, input: "A"},
        {name: "b", start: 3, length: 2, input: undefined, labels: {"0": "A", "3": "D"}},
    ]);
    assertRoundTrip(
        CircuitDefinition,
        new CircuitDefinition(
            5,
            [new GateColumn([Gates.HalfTurns.X, undefined, undefined, undefined, undefined])],
            undefined, undefined, undefined, false, new Map(), registers),
        {cols: [["X"]], registers: [
            {name: "a", wires: [0, 3], input: "A"},
            {name: "b", wires: [3, 2], labels: {"0": "A", "3": "D"}},
        ]});
});

suite.test("roundTrip_prepareBoxesKeepTheirParameter", () => {
    // Gates compare by identity, so a parsed box is checked by what it declares and writes back.
    const json = {cols: [[{id: "Prep2", arg: 3}, 1, {id: "PrepPsi1", arg: [[0.6, 0], [0, 0.8]]}]]};
    const circuit = Serializer.fromJson(CircuitDefinition, json);
    const [value, _, psi] = circuit.columns[0].gates;
    assertThat(value.param).isEqualTo(3);
    assertThat(value.knownPreparation).isEqualTo({kind: "value", value: 3});
    assertThat(psi.knownPreparation).isEqualTo({kind: "amplitudes", amplitudes: [[0.6, 0], [0, 0.8]]});
    assertThat(JSON.stringify(Serializer.toJson(circuit))).isEqualTo(JSON.stringify(json));
});

suite.test("fromJson_circuitDefinitionRejectsBrokenRegisters", () => {
    for (const registers of [
        {name: "a"},
        [{name: "a", wires: [0, 3]}, {name: "b", wires: [2, 1]}],
        [{name: "a", wires: [0, 2], input: "Q"}],
        [{name: "a", wires: [0, 2], labels: {"4": "E"}}],
        [{name: "a"}],
    ]) {
        assertThrows(() => Serializer.fromJson(CircuitDefinition, {cols: [], registers}));
    }
});
