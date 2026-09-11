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

import {DetailedError} from "../../base/DetailedError.js"
import {Matrix} from "./matrix/Matrix.js"

/**
 * The states a prepare box puts its wires in, as amplitudes.
 *
 * A preparation is a plain object:
 *
 *     {kind: "value", value}             the basis state |value⟩, little-endian: the box's first
 *                                        wire is the lowest bit
 *     {kind: "named", name}              "plus" (every value equally likely), "bell", "ghz" or "w"
 *     {kind: "amplitudes", amplitudes}   one [re, im] per basis state, normalised
 *
 * The prepare gates (src/gates/prepare/PrepareGates.js) declare one each; the column structure and
 * the hover card read the amplitudes off it here.
 *
 * @typedef {!({kind: "value", value: !int}|{kind: "named", name: !string}|
 *     {kind: "amplitudes", amplitudes: !Array.<!Array.<!number>>})} Preparation
 */

/**
 * @param {!Preparation} preparation
 * @param {!int} length How many wires the box covers.
 * @returns {!Float64Array} The 2^length amplitudes, real and imaginary parts interleaved.
 */
function preparedStateVector(preparation, length) {
    const size = 1 << length;
    const out = new Float64Array(size * 2);
    if (preparation.kind === "value") {
        out[preparation.value * 2] = 1;
        return out;
    }
    if (preparation.kind === "amplitudes") {
        preparation.amplitudes.forEach(([re, im], i) => {
            out[i * 2] = re;
            out[i * 2 + 1] = im;
        });
        return out;
    }
    switch (preparation.name) {
        case "plus":
            for (let i = 0; i < size; i++) {
                out[i * 2] = 1 / Math.sqrt(size);
            }
            return out;
        case "bell":
        case "ghz":
            // All zeros plus all ones; over two wires that is the Bell pair Φ⁺.
            out[0] = Math.SQRT1_2;
            out[(size - 1) * 2] = Math.SQRT1_2;
            return out;
        case "w":
            // Exactly one wire is 1, each equally likely.
            for (let k = 0; k < length; k++) {
                out[(1 << k) * 2] = 1 / Math.sqrt(length);
            }
            return out;
        default:
            throw new DetailedError("Unknown named preparation.", {preparation});
    }
}

/**
 * The matrix of a prepare box: it takes |0…0⟩ to the prepared state and discards every other
 * basis state - which is why a box is only allowed where its wires are still |0…0⟩. Rank one, so
 * not unitary.
 *
 * @param {!Preparation} preparation
 * @param {!int} length
 * @returns {!Matrix} 2^length by 2^length.
 */
function preparationMatrix(preparation, length) {
    const size = 1 << length;
    const amplitudes = preparedStateVector(preparation, length);
    const buffer = new Float64Array(size * size * 2);
    for (let row = 0; row < size; row++) {
        buffer[row * size * 2] = amplitudes[row * 2];
        buffer[row * size * 2 + 1] = amplitudes[row * 2 + 1];
    }
    return new Matrix(size, size, buffer);
}

export {preparationMatrix, preparedStateVector}
