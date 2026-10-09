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

import {Suite, assertThat} from "../../../TestUtil.js"
import { amplitudesToProbabilities } from "../../../../src/gates/displays/probability/shaders/amplitudesToProbabilities.js";

import {Controls} from "../../../../src/circuit/model/Controls.js"
import {Shaders} from "../../../../src/engine/webgl/operations/Shaders.js"

const suite = new Suite("ProbabilityDisplay");

suite.testUsingWebGL("amplitudesToProbabilities", () => {
    const inp = Shaders.vec2Data(new Float32Array([
        2, 3,
        4, 5,
        6, 7,
        8, 9,
        1/2, 0,
        0, 1/4,
        0, 1/8,
        1/16, 0
    ])).toVec2Texture(3);

    assertThat(amplitudesToProbabilities(inp, Controls.NONE).readVecFloatOutputs(3)).isApproximatelyEqualTo(new Float32Array([
        4+9,
        16+25,
        36+49,
        64+81,
        1/4,
        1/16,
        1/64,
        1/256
    ]));

    assertThat(amplitudesToProbabilities(inp, new Controls(0x5, 0x4)).readVecFloatOutputs(3))
        .isApproximatelyEqualTo(new Float32Array([0, 0, 0, 0, 1/4, 0, 1/64, 0]));

    inp.deallocByDepositingInPool();
});

suite.testUsingWebGL("amplitudesToProbabilities_largeControlReference", () => {
    const mask = new Controls(0b10111010101010111, 0b10011000001010001);
    const inp = Shaders.vec2Data(new Float32Array(2 << 13).fill(1)).toVec2Texture(13);
    const expected = Float32Array.from({length: 1 << 13}, (_, i) => mask.allowsState(i) ? 2 : 0);
    assertThat(amplitudesToProbabilities(inp, mask).readVecFloatOutputs(13)).isEqualTo(expected);
    inp.deallocByDepositingInPool();
});
