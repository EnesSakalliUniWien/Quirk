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
import { Simulation } from "../../../../config/Simulation.js";

const CONTROL_SELECT_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2('input')],
    Outputs.vec2(),
    `
    uniform float used;
    uniform float desired;

    /**
     * Inserts bits from the given value into the holes between used bits in the desired mask.
     */
    float scatter(float k) {
        float maskPos = 1.0;
        float coordPos = 1.0;
        float result = 0.0;
        for (int i = 0; i < ${Simulation.MAX_WIRE_COUNT}; i++) {
            float v = mod(floor(k/coordPos), 2.0);
            float u = mod(floor(used/maskPos), 2.0);
            float d = mod(floor(desired/maskPos), 2.0);
            result += (v + u*(d-v)) * maskPos;
            coordPos *= 2.0-u;
            maskPos *= 2.0;
        }
        return result;
    }

    vec2 outputFor(float k) {
        return read_input(scatter(k));
    }`);

export { CONTROL_SELECT_SHADER };
