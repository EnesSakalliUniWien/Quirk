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

const QUBIT_DENSITIES_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
    [Inputs.vec2('input')],
    Outputs.vec4(),
    `
    uniform float keptCount;
    uniform float keptBitMask;

    float scatter(float val, float used) {
        float result = 0.0;
        float posUsed = 1.0;
        float posVal = 1.0;
        for (int i = 0; i < ${Simulation.MAX_WIRE_COUNT}; i++) {
            float u = mod(floor(used/posUsed), 2.0);
            float v = mod(floor(val/posVal), 2.0);
            result += u * v * posUsed;
            posVal *= 1.0+u;
            posUsed *= 2.0;
        }
        return result;
    }

    vec4 outputFor(float k) {
        float bitIndex = mod(k, keptCount);
        float otherBits = floor(k / keptCount);
        float bit = scatter(exp2(bitIndex), keptBitMask);

        // Indices of the two complex values making up the current conditional ket.
        float srcIndex0 = mod(otherBits, bit) + floor(otherBits / bit) * bit * 2.0;
        float srcIndex1 = srcIndex0 + bit;

        // Grab the two complex values.
        vec2 w1 = read_input(srcIndex0);
        vec2 w2 = read_input(srcIndex1);

        // Compute density matrix components.
        float a = dot(w1, w1);
        float br = dot(w1, w2);
        float bi = dot(vec2(-w1.y, w1.x), w2);
        float d = dot(w2, w2);

        return vec4(a, br, bi, d);
    }`);

export { QUBIT_DENSITIES_SHADER };
