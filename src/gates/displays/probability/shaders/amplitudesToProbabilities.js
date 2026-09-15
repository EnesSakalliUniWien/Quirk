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

/**
 * @param {!WglTexture} inputTexture
 * @param {!WglTexture} controlTex
 * @returns {!WglConfiguredShader}
 */
const amplitudesToProbabilities = (inputTexture, controlTex) =>
  AMPLITUDES_TO_PROBABILITIES_SHADER(inputTexture, controlTex);

const AMPLITUDES_TO_PROBABILITIES_SHADER =
  makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2("input"), Inputs.bool("control")],
    Outputs.float(),
    `float outputFor(float k) {
        vec2 amp = read_input(k);
        return dot(amp, amp) * read_control(k);
    }`,
  );

export { amplitudesToProbabilities };
