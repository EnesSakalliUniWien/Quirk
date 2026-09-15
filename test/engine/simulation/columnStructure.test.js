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
import { fromJsonText_CircuitDefinition } from "../../../src/serialization/circuits/text.js";
import {columnStructure} from "../../../src/engine/simulation/columnStructure/columnStructure.js";
import {applyStructure, columnImage, structureFanOut, structureMatrix} from "../../../src/engine/simulation/columnStructure/evaluation.js";
import {engineColumnOperator} from "./engineColumnOperator.js"
import {CircuitStats} from "../../../src/engine/simulation/CircuitStats.js"
import {paddedState} from "../../../src/engine/simulation/stepAlgebra.js"

const suite = new Suite("columnStructure");

/**
 * @param {!Array.<!Array>} cols Columns as the circuit JSON writes them.
 * @param {!Array.<!Object>=} gates Custom gates, as the circuit JSON writes them.
 */
const fromJson = (cols, gates = []) => fromJsonText_CircuitDefinition(JSON.stringify({cols, gates}));

/**
 * The column's matrix two ways - from its structure, and from the engine running it on every basis
 * state - which must agree, because the structure is what the app shows for registers too large
 * for the engine to be asked.
 */
function assertMatchesEngine(cols, wireCount, time = 0, gates = []) {
    const circuit = fromJson(cols, gates);
    const col = circuit.columns.length - 1;
    const structure = columnStructure(circuit, col, wireCount, time);
    assertThat(structure.ok).withInfo({cols, reason: structure.reason}).isEqualTo(true);
    assertThat(structureMatrix(structure)).withInfo({cols}).
        isApproximatelyEqualTo(engineColumnOperator(circuit, col, wireCount, time), 1e-5);
}

suite.test("single-qubit gates, controls and anti-controls match the engine", () => {
    assertMatchesEngine([["H"]], 1);
    assertMatchesEngine([["•", "X"]], 2);
    assertMatchesEngine([["◦", "X"]], 2);
    assertMatchesEngine([["H", "•", "Z^½"]], 3);
});

suite.test("controls on other axes match the engine", () => {
    for (const control of ["⊕", "⊖", "⊗", "(/)"]) {
        assertMatchesEngine([[control, "X"]], 2);
        assertMatchesEngine([["•", control, "H"]], 3);
    }
});

suite.test("parity controls match the engine", () => {
    assertMatchesEngine([["zpar", "zpar", "X"]], 3);
    assertMatchesEngine([["xpar", "zpar", "H"]], 3);
    assertMatchesEngine([["ypar", "xpar", "Y"]], 3);
    assertMatchesEngine([["•", "xpar", "ypar", "X"]], 4);
});

suite.test("permutations, inputs and reversed inputs match the engine", () => {
    assertMatchesEngine([["inc3"]], 3);
    assertMatchesEngine([["+=A2", 1, "inputA2"]], 4);
    assertMatchesEngine([["+=A2", 1, "revinputA2"]], 4);
    assertMatchesEngine([["•", "inc2"]], 3);
});

suite.test("bit permutations and swaps match the engine", () => {
    assertMatchesEngine([["<<3"]], 3);
    assertMatchesEngine([["rev3"]], 3);
    assertMatchesEngine([["Swap", 1, "Swap"]], 3);
    assertMatchesEngine([["Swap", "•", "Swap"]], 3);
});

suite.test("rotations by an input register match the engine", () => {
    assertMatchesEngine([["X^(A/2^n)", "inputA2"]], 3);
    assertMatchesEngine([["Y^(-A/2^n)", "inputA2"]], 3);
    assertMatchesEngine([["Z^(A/2^n)", "inputA2"]], 3);
});

suite.test("gates built from circuits match the engine", () => {
    const bell = {id: "~bell", name: "Bell", circuit: {cols: [["H"], ["•", "X"]]}};
    assertMatchesEngine([["~bell"]], 2, 0, [bell]);
    assertMatchesEngine([["•", "~bell"]], 3, 0, [bell]);
    assertMatchesEngine([[1, "~bell"]], 3, 0, [bell]);
    // Inside, an adder reads an input register that sits outside the gate.
    const add = {id: "~add", name: "Add", circuit: {cols: [["+=A2"]]}};
    assertMatchesEngine([["~add", 1, "inputA2"]], 4, 0, [add]);
});

suite.test("time-dependent gates match the engine at the moment asked for", () => {
    assertMatchesEngine([["X^t"]], 1, 0.3);
    assertMatchesEngine([["•", "Z^t"]], 2, 0.7);
});

suite.test("nested initial-state operations precede columns and respect outer controls and offsets", () => {
    for (const initial of [1, "+", "-", "i", "-i"]) {
        const gate = {id: "~initial", circuit: {cols: [["Z"], ["X^t"]], init: [initial]}};
        assertMatchesEngine([["~initial"]], 1, 0.3, [gate]);
        assertMatchesEngine([[1, "~initial"]], 2, 0.3, [gate]);
        assertMatchesEngine([["•", "~initial"]], 2, 0.3, [gate]);
        assertMatchesEngine([["◦", "~initial"]], 2, 0.3, [gate]);
        assertMatchesEngine([["⊕", "~initial"]], 2, 0.3, [gate]);
    }
});

suite.test("initial-state operations survive empty and recursively nested circuits", () => {
    const initial = {id: "~initial", circuit: {cols: [], init: ["i"]}};
    const nested = {id: "~nested", circuit: {cols: [["~initial"], ["Z"]], init: [1]}};
    assertMatchesEngine([["~initial"]], 1, 0, [initial]);
    assertMatchesEngine([["•", "~nested"]], 2, 0, [initial, nested]);
});

suite.test("a top-level column does not repeat the circuit's initial-state operations", () => {
    const circuit = fromJsonText_CircuitDefinition(JSON.stringify({cols: [["Z"]], init: [1]}));
    const structure = columnStructure(circuit, 0, 1, 0);
    assertThat(structure.ok).isEqualTo(true);
    assertThat(structureMatrix(structure)).isApproximatelyEqualTo(Matrix.square(1, 0, 0, -1), 1e-9);
});

suite.test("a default input set by an earlier column is read from the column's context", () => {
    const circuit = fromJson([[{id: "setA", arg: 3}], ["+=A2"]]);
    const structure = columnStructure(circuit, 1, 2, 0);
    assertThat(structure.ok).isEqualTo(true);
    // The engine cannot run this column on its own, but the answer is plain: |c> goes to |c + 3 mod 4>.
    for (let c = 0; c < 4; c++) {
        assertThat([...columnImage(structure, c).keys()]).isEqualTo([(c + 3) & 3]);
    }
});

suite.test("a register far too large for a dense matrix is answered basis state by basis state", () => {
    // Asking this gate for its matrix would allocate 65,536 x 65,536 entries.
    const increment = columnStructure(fromJson([["inc16"]]), 0, 16, 0);
    assertThat(increment.ok).isEqualTo(true);
    assertThat(structureFanOut(increment)).isEqualTo(1);
    assertThat([...columnImage(increment, 65535).entries()]).isEqualTo([[0, [1, 0]]]);

    // A Hadamard on every wire spreads one basis state over all 65,536: its fan-out, not 4^n.
    const spread = columnStructure(fromJson([Array(16).fill("H")]), 0, 16, 0);
    assertThat(structureFanOut(spread)).isEqualTo(65536);
    const image = columnImage(spread, 0);
    assertThat(image.size).isEqualTo(65536);
    assertThat(image.get(12345)[0]).isApproximatelyEqualTo(1 / 256, 1e-9);
});

suite.test("applying a structure to a state stays within its budget", () => {
    const structure = columnStructure(fromJson([["H", "H"]]), 0, 2, 0);
    assertThat(applyStructure(structure, Matrix.col(1, 0, 0, 0), 100)).
        isApproximatelyEqualTo(Matrix.col(0.5, 0.5, 0.5, 0.5), 1e-9);
    // Four nonzero amplitudes, each spreading over four basis states, is sixteen updates.
    assertThat(applyStructure(structure, Matrix.col(0.5, 0.5, 0.5, 0.5), 15)).isEqualTo(undefined);
});

suite.test("a detector measures at random, so its column has no matrix", () => {
    for (const cols of [[["ZDetector"]], [["XDetectControlReset", "X"]]]) {
        const structure = columnStructure(fromJson(cols), 0, 2, 0);
        assertThat(structure.ok).withInfo({cols}).isEqualTo(false);
        assertThat(structure.reason.includes("random")).withInfo({cols, reason: structure.reason}).isEqualTo(true);
    }
});

suite.test("a register that feeds input A serves the column the way an input gate would", () => {
    const viaGate = fromJson([["+=A2", 1, "inputA2"]]);
    const viaRegister = fromJsonText_CircuitDefinition(JSON.stringify(
        {cols: [["+=A2"]], registers: [{name: "x", wires: [2, 2], input: "A"}]}));
    const structure = columnStructure(viaRegister, 0, 4, 0);
    assertThat(structure.ok).withInfo({reason: structure.reason}).isEqualTo(true);
    assertThat(structureMatrix(structure)).isApproximatelyEqualTo(structureMatrix(columnStructure(viaGate, 0, 4, 0)), 1e-9);

    // And the simulator agrees: with x at 3, the adder adds 3.
    const run = json => paddedState(
        CircuitStats.fromCircuitAtTime(fromJsonText_CircuitDefinition(JSON.stringify(json)), 0).finalState, 4);
    assertThat(run({cols: [["+=A2"]], init: [0, 0, 1, 1], registers: [{name: "x", wires: [2, 2], input: "A"}]})).
        isApproximatelyEqualTo(run({cols: [["+=A2", 1, "inputA2"]], init: [0, 0, 1, 1]}), 1e-6);
});


suite.test("a prepare box takes |0…0⟩ of its wires to its state and discards the rest", () => {
    const s = Math.SQRT1_2;
    const structure = columnStructure(fromJson([[1, "PrepBell"]]), 0, 3, 0);
    assertThat(structure.ok).withInfo({reason: structure.reason}).isEqualTo(true);
    assertThat(structureFanOut(structure)).isEqualTo(2);
    // q0 = 1 and the pair at |00⟩: it becomes (|001⟩ + |111⟩)/√2.
    assertThat([...columnImage(structure, 1).entries()]).isApproximatelyEqualTo([[1, [s, 0]], [7, [s, 0]]], 1e-12);
    // The pair away from |00⟩ has nowhere to go.
    assertThat(columnImage(structure, 0b010).size).isEqualTo(0);

    const value = columnStructure(fromJson([[{id: "Prep3", arg: 5}]]), 0, 3, 0);
    assertThat([...columnImage(value, 0).entries()]).isEqualTo([[5, [1, 0]]]);
});
