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

import { multiQubitOperationMaker } from "./multiQubitOperationMaker.js";
import { hugeQubitOperationMaker } from "./hugeQubitOperationMaker.js";

const matrix_operation_shaders = [
    undefined,
    undefined,
    multiQubitOperationMaker(2),
    multiQubitOperationMaker(3),
    hugeQubitOperationMaker(4)
];

export { matrix_operation_shaders };
