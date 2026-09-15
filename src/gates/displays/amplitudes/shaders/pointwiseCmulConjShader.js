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

import { Inputs, Outputs, makePseudoShaderWithInputsAndOutputAndCode } from "../../../../engine/webgl/coder/ShaderCoders.js";

const POINTWISE_CMUL_CONJ_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.vec2("small_input"), Inputs.vec2("large_input")],
  Outputs.vec2(),
  `
    vec2 cmul_conj(vec2 c1, vec2 c2) {
        return mat2(c1.x, -c1.y, c1.y, c1.x) * c2;
    }
    vec2 outputFor(float k) {
        vec2 in1 = read_small_input(floor(mod(k + 0.5, len_small_input())));
        vec2 in2 = read_large_input(k);
        return cmul_conj(in1, in2);
    }
    `,
);

export { POINTWISE_CMUL_CONJ_SHADER };
