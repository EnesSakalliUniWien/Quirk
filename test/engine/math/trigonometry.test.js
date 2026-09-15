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

import { Suite, assertThat } from "../../TestUtil.js";
import { snappedCosSin } from "../../../src/engine/math/trigonometry.js";

const suite = new Suite("trigonometry");

suite.test("snappedCosSin", () => {
    const r = Math.PI/4;
    const s = Math.sqrt(0.5);

    assertThat(snappedCosSin(0.123)).isEqualTo([Math.cos(0.123), Math.sin(0.123)]);

    assertThat(snappedCosSin(0)).isEqualTo([1, 0]);
    assertThat(snappedCosSin(r)).isEqualTo([s, s]);
    assertThat(snappedCosSin(2*r)).isEqualTo([0, 1]);
    assertThat(snappedCosSin(3*r)).isEqualTo([-s, s]);
    assertThat(snappedCosSin(4*r)).isEqualTo([-1, 0]);
    assertThat(snappedCosSin(5*r)).isEqualTo([-s, -s]);
    assertThat(snappedCosSin(6*r)).isEqualTo([0, -1]);
    assertThat(snappedCosSin(7*r)).isEqualTo([s, -s]);
    assertThat(snappedCosSin(8*r)).isEqualTo([1, 0]);

    assertThat(snappedCosSin(-8*r)).isEqualTo([1, 0]);
    assertThat(snappedCosSin(-7*r)).isEqualTo([s, s]);
    assertThat(snappedCosSin(-6*r)).isEqualTo([0, 1]);
    assertThat(snappedCosSin(-5*r)).isEqualTo([-s, s]);
    assertThat(snappedCosSin(-4*r)).isEqualTo([-1, 0]);
    assertThat(snappedCosSin(-3*r)).isEqualTo([-s, -s]);
    assertThat(snappedCosSin(-2*r)).isEqualTo([0, -1]);
    assertThat(snappedCosSin(-1*r)).isEqualTo([s, -s]);
});
