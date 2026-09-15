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
import { WglArg } from "../../../../engine/webgl/shader/WglArg.js";

/**
 * @param {!WglTexture} inputTexture
 * @param {!int} qubitSpan
 * @returns {!WglConfiguredShader}
 */
const amplitudesToCouplings = (inputTexture, qubitSpan) => AMPLITUDES_TO_DENSITIES_SHADER(
    inputTexture,
    WglArg.float('qubitSpan', 1 << qubitSpan));

const AMPLITUDES_TO_DENSITIES_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2('input')],
    Outputs.vec2(),
    `
    uniform float qubitSpan;

    vec2 outputFor(float k) {
        float k_ket = mod(k, qubitSpan);
        float k_bra = mod(floor(k / qubitSpan), qubitSpan);
        float k_rest = floor(k / qubitSpan / qubitSpan);
        float offset = k_rest*qubitSpan;

        vec2 ampKet = read_input(k_ket + offset);
        vec2 ampBra = read_input(k_bra + offset);
        float r = dot(ampKet, ampBra);
        float i = dot(ampKet, vec2(-ampBra.y, ampBra.x));

        return vec2(r, i);
    }`);

export { amplitudesToCouplings };
