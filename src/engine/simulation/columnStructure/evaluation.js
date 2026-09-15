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

import {Matrix} from "../../math/matrix/Matrix.js";
import {evolve} from "./sparseEvolution.js";

/** @typedef {import("./columnStructure.js").ColumnStructure} ColumnStructure */

/** An amplitude this small is a zero that rounding left behind. */
const NEGLIGIBLE = 1e-12;

/**
 * Where one basis state goes under the column: the nonzero amplitudes of U|basis⟩.
 *
 * @param {!ColumnStructure} structure
 * @param {!int} basis
 * @returns {!Map.<!int, !Array.<!number>>} Output basis state -> [re, im].
 */
function columnImage(structure, basis) {
    const amplitudes = evolve(structure, new Map([[basis, [1, 0]]]));
    for (const [index, [re, im]] of amplitudes) {
        if (re * re + im * im < NEGLIGIBLE * NEGLIGIBLE) {
            amplitudes.delete(index);
        }
    }
    return amplitudes;
}

/**
 * At most how many basis states one basis state spreads over: what one column of the operator
 * costs to work out. A permutation is 1; a Hadamard on every one of n wires is 2^n.
 *
 * @param {!ColumnStructure} structure
 * @returns {!number}
 */
function structureFanOut(structure) {
    let fanOut = 1;
    for (const op of [...structure.setup, ...structure.core, ...structure.cleanup]) {
        if (op.kind === 'single' || op.kind === 'inputRotation') {
            fanOut *= 2;
        } else if (op.kind === 'dense') {
            fanOut *= 1 << op.height;
        } else if (op.kind === 'prepare') {
            fanOut *= op.nonzero;
        } else if (op.kind === 'nested') {
            fanOut *= op.fanOut;
        }
    }
    return Math.min(fanOut, 1 << structure.wireCount);
}

/**
 * The column's dense matrix, built one basis state at a time. Only for small registers: it has
 * 4^n entries.
 *
 * @param {!ColumnStructure} structure
 * @returns {!Matrix}
 */
function structureMatrix(structure) {
    const size = 1 << structure.wireCount;
    const buffer = new Float64Array(size * size * 2);
    for (let basis = 0; basis < size; basis++) {
        for (const [row, [re, im]] of columnImage(structure, basis)) {
            buffer[(row * size + basis) * 2] = re;
            buffer[(row * size + basis) * 2 + 1] = im;
        }
    }
    return new Matrix(size, size, buffer);
}

/**
 * The column applied to a whole state, or undefined when that would take more than `budget`
 * amplitude updates. Zero amplitudes cost nothing, so a state with few nonzero amplitudes is cheap
 * at any size; a column that spreads every basis state over the register, like a Hadamard on
 * every wire of a uniform superposition, is not.
 *
 * @param {!ColumnStructure} structure
 * @param {!Matrix} state A column vector over the structure's wires.
 * @param {!number} budget
 * @returns {undefined|!Matrix}
 */
function applyStructure(structure, state, budget) {
    const source = state.rawBuffer();
    const size = 1 << structure.wireCount;
    const buffer = new Float64Array(size * 2);
    const fanOut = structureFanOut(structure);
    let spent = 0;
    for (let basis = 0; basis < size; basis++) {
        const ar = source[basis * 2], ai = source[basis * 2 + 1];
        if (ar * ar + ai * ai < NEGLIGIBLE * NEGLIGIBLE) {
            continue;
        }
        spent += fanOut;
        if (spent > budget) {
            return undefined;
        }
        for (const [row, [re, im]] of columnImage(structure, basis)) {
            buffer[row * 2] += ar * re - ai * im;
            buffer[row * 2 + 1] += ar * im + ai * re;
        }
    }
    return new Matrix(1, size, buffer);
}

export {applyStructure, columnImage, structureFanOut, structureMatrix};
