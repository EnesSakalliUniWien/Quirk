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
import {preparationMatrix, preparedStateVector} from "../../../src/engine/math/preparedStates.js"

const suite = new Suite("preparedStates");

/** The nonzero amplitudes as [index, re, im], so the expectations read as kets. */
const nonzero = vector => {
    const out = [];
    for (let i = 0; i < vector.length / 2; i++) {
        if (vector[i * 2] !== 0 || vector[i * 2 + 1] !== 0) {
            out.push([i, vector[i * 2], vector[i * 2 + 1]]);
        }
    }
    return out;
};

suite.test("each preparation has the amplitudes its name says", () => {
    const s = Math.SQRT1_2;
    assertThat(nonzero(preparedStateVector({kind: "value", value: 5}, 3))).isEqualTo([[5, 1, 0]]);
    assertThat(nonzero(preparedStateVector({kind: "named", name: "plus"}, 2))).
        isApproximatelyEqualTo([[0, 0.5, 0], [1, 0.5, 0], [2, 0.5, 0], [3, 0.5, 0]], 1e-12);
    assertThat(nonzero(preparedStateVector({kind: "named", name: "bell"}, 2))).
        isApproximatelyEqualTo([[0, s, 0], [3, s, 0]], 1e-12);
    assertThat(nonzero(preparedStateVector({kind: "named", name: "ghz"}, 3))).
        isApproximatelyEqualTo([[0, s, 0], [7, s, 0]], 1e-12);
    const t = 1 / Math.sqrt(3);
    assertThat(nonzero(preparedStateVector({kind: "named", name: "w"}, 3))).
        isApproximatelyEqualTo([[1, t, 0], [2, t, 0], [4, t, 0]], 1e-12);
    assertThat(nonzero(preparedStateVector({kind: "amplitudes", amplitudes: [[0.6, 0], [0, 0.8]]}, 1))).
        isApproximatelyEqualTo([[0, 0.6, 0], [1, 0, 0.8]], 1e-12);
});

suite.test("a preparation's matrix takes |0…0⟩ to the state and discards the rest", () => {
    const s = Math.SQRT1_2;
    assertThat(preparationMatrix({kind: "named", name: "bell"}, 2)).isApproximatelyEqualTo(Matrix.fromRows([
        [s, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [s, 0, 0, 0],
    ]), 1e-12);
});
