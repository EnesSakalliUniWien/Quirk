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
import {Registers} from "../../src/circuit/model/Registers.js"
import {
    ketBits,
    ketBitsHeader,
    ketFields,
    ketLabel,
    wireLabel,
    wiresLabel,
} from "../../src/circuit/registerLabels.js"

const suite = new Suite("registerLabels");

const reg = (name, start, length, labels = undefined) => ({name, start, length, input: undefined, labels});
const REGISTERS = new Registers([reg("a", 0, 3), reg("b", 3, 2)]);
// a = 6 (110), b = 3 (11), q5 = 1: 1 11 110 in binary, highest wire first.
const INDEX = 0b111110;

suite.test("wires are named by register, and keep their q-label outside one", () => {
    assertThat(wireLabel(REGISTERS, 0)).isEqualTo("a₀");
    assertThat(wireLabel(REGISTERS, 4)).isEqualTo("b₁");
    assertThat(wireLabel(REGISTERS, 5)).isEqualTo("q5");
    assertThat(wireLabel(Registers.EMPTY, 3)).isEqualTo("q3");
    assertThat(wireLabel(new Registers([reg("x", 0, 12)]), 11)).isEqualTo("x₁₁");

    assertThat(wiresLabel(REGISTERS, 0, 3)).isEqualTo("a");
    assertThat(wiresLabel(REGISTERS, 1, 2)).isEqualTo("a₁–a₂");
    assertThat(wiresLabel(REGISTERS, 5, 1)).isEqualTo("q5");
    assertThat(wiresLabel(Registers.EMPTY, 0, 3)).isEqualTo("q0–q2");
});

suite.test("a basis state reads by register, and as plain bits without any", () => {
    assertThat(ketLabel(Registers.EMPTY, 3, 5)).isEqualTo("101");
    assertThat(ketLabel(REGISTERS, 6, INDEX)).isEqualTo("a=6, b=3, q5=1");
    assertThat(ketBits(REGISTERS, 6, INDEX)).isEqualTo("1·11·110");
    assertThat(ketBits(Registers.EMPTY, 3, 5)).isEqualTo("101");
    assertThat(ketFields(REGISTERS, 6, INDEX).map(f => [f.name, f.text])).
        isEqualTo([["a", "6"], ["b", "3"], ["q5", "1"]]);
    assertThat(ketFields(new Registers([reg("m", 2, 1)]), 5, 0b10011).map(f => [f.name, f.text])).
        isEqualTo([["q0–q1", "11"], ["m", "0"], ["q3–q4", "10"]]);
});

suite.test("a labelled value reads by its label", () => {
    const labelled = new Registers([reg("a", 0, 3, {"6": "six"}), reg("b", 3, 2, {"0": "A", "3": "D"})]);
    assertThat(ketLabel(labelled, 6, INDEX)).isEqualTo("a=six, b=D, q5=1");
    assertThat(ketLabel(labelled, 6, 0)).isEqualTo("a=0, b=A, q5=0");
    assertThat(ketBits(labelled, 6, INDEX)).isEqualTo("1·11·110");
});

suite.test("the bits column's header names each wire in the column's order", () => {
    assertThat(ketBitsHeader(REGISTERS, 6)).isEqualTo("q5·b₁b₀·a₂a₁a₀");
    assertThat(ketBitsHeader(new Registers([reg("m", 2, 1)]), 5)).isEqualTo("q4 q3·m₀·q1 q0");
    assertThat(ketBitsHeader(Registers.EMPTY, 2)).isEqualTo("q1 q0");
});
