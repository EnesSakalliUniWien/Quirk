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

const MAGS_TO_INDEXED_MAGS_SHADER = makePseudoShaderWithInputsAndOutputAndCode(
  [Inputs.float("input")],
  Outputs.vec2(),
  `vec2 outputFor(float k) {
        return vec2(float(k), read_input(k));
    }`,
);

export { MAGS_TO_INDEXED_MAGS_SHADER };
