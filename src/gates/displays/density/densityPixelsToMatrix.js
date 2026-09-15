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
import { decohereMeasuredBitsInDensityMatrix } from "./decohereMeasuredBitsInDensityMatrix.js";

/**
 * Normalizes density pixels, removes measured-bit coherences, and transposes for display.
 * @param {!Float32Array} pixels
 * @param {!CircuitDefinition} circuitDefinition
 * @param {!int} col
 * @param {!int} row
 * @returns {!Matrix}
 */
function densityPixelsToMatrix(pixels, circuitDefinition, col, row) {
    const n = pixels.length >> 1;
    const d = Math.round(Math.sqrt(n));
    let unity = 0;
    for (let i = 0; i < d; i++) {
        unity += pixels[2*i*(d+1)];
    }
    if (Number.isNaN(unity) || unity < 0.000001) {
        return Matrix.zero(d, d).times(NaN);
    }
    for (let i = 0; i < pixels.length; i++) {
        pixels[i] /= unity;
    }

    const isMeasuredMask = circuitDefinition.colIsMeasuredMask(col) >> row;
    return decohereMeasuredBitsInDensityMatrix(new Matrix(d, d, pixels), isMeasuredMask).transpose();
}

export { densityPixelsToMatrix };
