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

import { ketShader } from "../KetShaderUtil.js";

const multiQubitOperationMaker = qubitCount => ketShader(
    `uniform vec4 coefs[${1<<(2*qubitCount-1)}];`,
    `
        int row = int(out_id);
        vec2 t = vec2(0.0, 0.0);
        for (int d = 0; d < ${1<<qubitCount}; d++) {
            // Can't index by row, since it's not a constant, so we do a const brute force loop searching for it.
            if (d == row) {
                for (int k = 0; k < ${1<<(qubitCount-1)}; k++) {
                    vec4 u = coefs[d*${1<<(qubitCount-1)} + k];
                    t += cmul(inp(float(k*2)), u.xy);
                    t += cmul(inp(float(k*2+1)), u.zw);
                }
            }
        }
        return t;
    `,
    qubitCount);

export { multiQubitOperationMaker };
