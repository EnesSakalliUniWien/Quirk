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

import { Inputs } from "../../../webgl/coder/ShaderCoders.js";
import { ketShader } from "../KetShaderUtil.js";

const hugeQubitOperationMaker = qubitCount => ketShader(
    '',
    `
        vec2 t = vec2(0.0, 0.0);
        for (int k = 0; k < ${1<<qubitCount}; k++) {
            t += cmul(inp(float(k)),
                      read_coefs(out_id * ${1<<qubitCount}.0 + float(k)));
        }
        return t;
    `,
    qubitCount,
    [Inputs.vec2('coefs')]);

export { hugeQubitOperationMaker };
