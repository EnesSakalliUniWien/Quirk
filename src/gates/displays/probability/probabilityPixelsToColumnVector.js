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

/**
 * Converts probability texture pixels into a column vector of normalized probabilities.
 * @param {!Float32Array} pixels
 * @param {!int} span
 * @returns {!Matrix}
 */
function probabilityPixelsToColumnVector(pixels, span) {
  const n = 1 << span;
  // CAUTION: pixels may be longer than n due to the length rounding up to a multiple of 4.

  let unity = 0;
  for (let i = 0; i < n; i++) {
    unity += pixels[i];
  }
  if (Number.isNaN(unity) || unity < 0.000001) {
    return Matrix.zero(1, n).times(NaN);
  }
  const buf = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    buf[i * 2] = pixels[i] / unity;
  }
  return new Matrix(1, n, buf);
}

export { probabilityPixelsToColumnVector };
