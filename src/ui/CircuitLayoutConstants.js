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

/**
 * Geometry shared by the circuit itself and the code that maps positions back onto it.
 */

/** @type {!number} */
const CIRCUIT_OP_HORIZONTAL_SPACING = 10;

/** @type {!number} Matches Layout.TOOLBOX_MARGIN_X so gate columns align with the toolbox groups. */
const CIRCUIT_OP_LEFT_SPACING = 32;

export {CIRCUIT_OP_HORIZONTAL_SPACING, CIRCUIT_OP_LEFT_SPACING}
