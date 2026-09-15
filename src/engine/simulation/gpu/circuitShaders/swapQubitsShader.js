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

import { ketShaderPermute } from "../KetShaderUtil.js";

const SWAP_QUBITS_SHADER = ketShaderPermute('', `
    float low_bit = mod(out_id, 2.0);
    float mid_bits = floor(mod(out_id, span*0.5)*0.5);
    float high_bit = floor(out_id*2.0/span);
    return high_bit + mid_bits*2.0 + low_bit*span*0.5;`);

export { SWAP_QUBITS_SHADER };
