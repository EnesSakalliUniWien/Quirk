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

import { Inputs, Outputs, makePseudoShaderWithInputsAndOutputAndCode } from "../../../webgl/coder/ShaderCoders.js";

const CYCLE_ALL_SHADER_VEC2 = makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2('input')],
    Outputs.vec2(),
    `
    uniform float shiftAmount;

    vec2 outputFor(float k) {
        float span = len_input();
        float shiftedState = k * shiftAmount;
        float cycledState = mod(shiftedState, span) + floor(shiftedState / span);
        return read_input(cycledState);
    }`);

export { CYCLE_ALL_SHADER_VEC2 };
