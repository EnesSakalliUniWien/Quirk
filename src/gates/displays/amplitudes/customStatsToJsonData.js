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

import { Matrix } from "../../../engine/math/matrix/Matrix.js";
import { ReadableJson } from "../../../engine/math/matrix/ReadableJson.js";

/**
 * @param {!{quality: !number, ket: !Matrix, phaseLockIndex: !int,incoherentKet: !Matrix}} customStats
 */
function customStatsToJsonData(customStats) {
  const { quality, ket, phaseLockIndex, incoherentKet } = customStats;
  const n = ket.width() * ket.height();
  return {
    coherence_measure: quality,
    superposition_phase_locked_state_index:
      phaseLockIndex === undefined ? null : phaseLockIndex,
    ket: ReadableJson.complexVector(
      new Matrix(1, n, ket.rawBuffer()).getColumn(0),
    ),
    incoherentKet: ReadableJson.realVector(
      new Matrix(1, n, incoherentKet.rawBuffer()).getColumn(0),
    ),
  };
}

export { customStatsToJsonData };
