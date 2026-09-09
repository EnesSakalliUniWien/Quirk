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
import {describeAxis, describeKet} from "../../src/circuit/gateDescription.js"

import {Format} from "../../src/base/Format.js"
import {Complex} from "../../src/engine/math/complex/Complex.js"

const suite = new Suite("gateDescription");

suite.test("describeAxis", () => {
    const s = Math.sqrt(2);

    assertThat(describeAxis([1, 0, 0], Format.SIMPLIFIED)).isEqualTo("X");
    assertThat(describeAxis([0, 1, 0], Format.SIMPLIFIED)).isEqualTo("Y");
    assertThat(describeAxis([0, 0, 1], Format.SIMPLIFIED)).isEqualTo("Z");

    assertThat(describeAxis([s, s, 0], Format.SIMPLIFIED)).isEqualTo("X + Y");
    assertThat(describeAxis([0, s, s], Format.SIMPLIFIED)).isEqualTo("Y + Z");
    assertThat(describeAxis([s, 0, s], Format.SIMPLIFIED)).isEqualTo("X + Z");

    assertThat(describeAxis([-s, s, 0], Format.SIMPLIFIED)).isEqualTo("-X + Y");
    assertThat(describeAxis([0, -s, s], Format.SIMPLIFIED)).isEqualTo("-Y + Z");
    assertThat(describeAxis([s, 0, -s], Format.SIMPLIFIED)).isEqualTo("X - Z");

    assertThat(describeAxis([1, -1, 1], Format.SIMPLIFIED)).isEqualTo("X - Y + Z");

    assertThat(describeAxis([1, 0.5, 0.25], Format.SIMPLIFIED)).isEqualTo("X + ½·Y + ¼·Z");
    assertThat(describeAxis([1, 0.5, 0.25], Format.CONSISTENT)).isEqualTo("X + 0.50·Y + 0.25·Z");
});

suite.test("describeKet", () => {
    assertThat(describeKet(1, 0, 1, Format.SIMPLIFIED)).isEqualTo('|0⟩');
    assertThat(describeKet(1, 1, 1, Format.SIMPLIFIED)).isEqualTo('|1⟩');

    assertThat(describeKet(2, 0, 1, Format.SIMPLIFIED)).isEqualTo('|00⟩');
    assertThat(describeKet(2, 1, 1, Format.SIMPLIFIED)).isEqualTo('|01⟩');
    assertThat(describeKet(2, 2, 1, Format.SIMPLIFIED)).isEqualTo('|10⟩');
    assertThat(describeKet(2, 3, 1, Format.SIMPLIFIED)).isEqualTo('|11⟩');

    assertThat(describeKet(2, 0, new Complex(-1, 0), Format.SIMPLIFIED)).isEqualTo('-|00⟩');
    assertThat(describeKet(2, 1, Complex.I, Format.SIMPLIFIED)).isEqualTo('i|01⟩');
    assertThat(describeKet(2, 2, new Complex(0, -1), Format.SIMPLIFIED)).isEqualTo('-i|10⟩');
    assertThat(describeKet(2, 3, new Complex(1, 1), Format.SIMPLIFIED)).isEqualTo('(1+i)·|11⟩');
});
