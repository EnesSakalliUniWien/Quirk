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

import { Outputs, makePseudoShaderWithInputsAndOutputAndCode } from "../../../webgl/coder/ShaderCoders.js";
import { Simulation } from "../../../../config/Simulation.js";

const CONTROL_MASK_SHADER = makePseudoShaderWithInputsAndOutputAndCode([], Outputs.bool(), `
    uniform float used;
    uniform float desired;

    bool outputFor(float k) {
        float pass = 1.0;
        float bit = 1.0;
        for (int i = 0; i < ${Simulation.MAX_WIRE_COUNT}; i++) {
            float v = mod(floor(k/bit), 2.0);
            float u = mod(floor(used/bit), 2.0);
            float d = mod(floor(desired/bit), 2.0);
            pass *= 1.0 - abs(v-d)*u;
            bit *= 2.0;
        }
        return pass == 1.0;
    }`);

export { CONTROL_MASK_SHADER };
