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
 * The probability of each state, or 0 for states not meeting the controls.
 * @param {!WglTexture} inputTexture
 * @param {!Controls} controls
 * @returns {!WglConfiguredShader}
 */
const amplitudesToProbabilities = (inputTexture, controls) =>
  AMPLITUDES_TO_PROBABILITIES_SHADER(
    inputTexture,
    WglArg.float("used", controls.inclusionMask),
    WglArg.float("desired", controls.desiredValueMask),
  );

const AMPLITUDES_TO_PROBABILITIES_SHADER =
  makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2("input")],
    Outputs.float(),
    `
    uniform float used;
    uniform float desired;

    float outputFor(float k) {
        vec2 amp = read_input(k);
        return (uint(k) & uint(used)) == uint(desired) ? dot(amp, amp) : 0.0;
    }`,
  );

export { amplitudesToProbabilities };
