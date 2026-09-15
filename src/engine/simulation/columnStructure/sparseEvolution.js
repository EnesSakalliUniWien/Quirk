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

/** @typedef {import("./columnStructure.js").ColumnStructure} ColumnStructure */

/**
 * @param {!{offset: !int, length: !int, fallback: !int}} input
 * @param {!int} index A basis state.
 * @returns {!int} The input's value in that basis state.
 */
function readInput(input, index) {
    return input.length === 0 ? input.fallback : (index >> input.offset) & ((1 << input.length) - 1);
}

/**
 * The 2x2 matrix of a rotation by `angle` around an axis, the way the parametrized rotation gates'
 * shaders build it: u = (1 + e^iθ)/2 on the diagonal.
 *
 * @param {!string} axis
 * @param {!number} angle
 * @returns {!Array.<!number>} Row-major, interleaved real and imaginary parts.
 */
function rotationMatrix(axis, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const ur = (1 + c) / 2, ui = s / 2;
    switch (axis) {
        case 'X': return [ur, ui, (1 - c) / 2, -s / 2, (1 - c) / 2, -s / 2, ur, ui];
        // v = i(1 - e^iθ)/2, as [[u, -v], [v, u]].
        case 'Y': return [ur, ui, -s / 2, -(1 - c) / 2, s / 2, (1 - c) / 2, ur, ui];
        default: return [1, 0, 0, 0, 0, 0, c, s];
    }
}

/**
 * @param {!Map.<!int, !Array.<!number>>} amplitudes
 * @param {!int} index
 * @param {!number} re
 * @param {!number} im
 */
function accumulate(amplitudes, index, re, im) {
    const existing = amplitudes.get(index);
    if (existing === undefined) {
        amplitudes.set(index, [re, im]);
    } else {
        existing[0] += re;
        existing[1] += im;
    }
}

/**
 * @param {!int} value
 * @param {!Array.<!int>} positions Where each of the low bits goes.
 * @returns {!int}
 */
function moveBits(value, positions) {
    let out = 0;
    for (let i = 0; i < positions.length; i++) {
        if ((value & (1 << i)) !== 0) {
            out |= 1 << positions[i];
        }
    }
    return out;
}

/**
 * Applies a 2x2 matrix to one wire of one basis state.
 */
function applySingle(out, m, wire, index, re, im) {
    const bit = (index >> wire) & 1;
    const cleared = index & ~(1 << wire);
    for (let target = 0; target < 2; target++) {
        const k = (target * 2 + bit) * 2;
        const mr = m[k], mi = m[k + 1];
        if (mr !== 0 || mi !== 0) {
            accumulate(out, cleared | (target << wire), re * mr - im * mi, re * mi + im * mr);
        }
    }
}

/**
 * The nonzero entries of one column of a gate's dense matrix, found once and kept.
 *
 * @param {!Object} op A 'dense' piece.
 * @param {!int} input
 * @returns {!Array.<!number>} Triples of target, real part, imaginary part.
 */
function denseColumn(op, input) {
    let entries = op.columns[input];
    if (entries === undefined) {
        const size = 1 << op.height;
        entries = [];
        for (let target = 0; target < size; target++) {
            const k = (target * size + input) * 2;
            if (op.buffer[k] !== 0 || op.buffer[k + 1] !== 0) {
                entries.push(target, op.buffer[k], op.buffer[k + 1]);
            }
        }
        op.columns[input] = entries;
    }
    return entries;
}

/**
 * Applies one piece of a column to a sparse state.
 *
 * @param {!Object} op
 * @param {!Map.<!int, !Array.<!number>>} amplitudes
 * @returns {!Map.<!int, !Array.<!number>>}
 */
function applyOp(op, amplitudes) {
    const out = new Map();
    for (const [index, [re, im]] of amplitudes) {
        switch (op.kind) {
            case 'single':
                applySingle(out, op.m, op.wire, index, re, im);
                break;
            case 'inputRotation': {
                const a = readInput(op.input, index);
                let m = op.cache.get(a);
                if (m === undefined) {
                    m = rotationMatrix(op.axis, a * op.factor / (1 << op.input.length));
                    op.cache.set(a, m);
                }
                applySingle(out, m, op.wire, index, re, im);
                break;
            }
            case 'dense': {
                const mask = (1 << op.height) - 1;
                const cleared = index & ~(mask << op.row);
                const entries = denseColumn(op, (index >> op.row) & mask);
                for (let e = 0; e < entries.length; e += 3) {
                    const mr = entries[e + 1], mi = entries[e + 2];
                    accumulate(out, cleared | (entries[e] << op.row), re * mr - im * mi, re * mi + im * mr);
                }
                break;
            }
            case 'prepare': {
                const mask = (1 << op.height) - 1;
                if (((index >> op.row) & mask) !== 0) {
                    break;
                }
                for (let v = 0; v <= mask; v++) {
                    const ar = op.amplitudes[v * 2], ai = op.amplitudes[v * 2 + 1];
                    if (ar !== 0 || ai !== 0) {
                        accumulate(out, index | (v << op.row), re * ar - im * ai, re * ai + im * ar);
                    }
                }
                break;
            }
            case 'permutation': {
                const mask = (1 << op.height) - 1;
                const inputs = op.inputs.map(input => readInput(input, index));
                const target = op.func((index >> op.row) & mask, ...inputs) & mask;
                accumulate(out, (index & ~(mask << op.row)) | (target << op.row), re, im);
                break;
            }
            case 'bits': {
                const mask = (1 << op.height) - 1;
                const moved = moveBits((index >> op.row) & mask, op.positions);
                accumulate(out, (index & ~(mask << op.row)) | (moved << op.row), re, im);
                break;
            }
            case 'swap': {
                const differ = ((index >> op.a) ^ (index >> op.b)) & 1;
                accumulate(out, differ === 0 ? index : index ^ (1 << op.a) ^ (1 << op.b), re, im);
                break;
            }
            case 'nested': {
                let inner = new Map([[index, [re, im]]]);
                for (const structure of op.structures) {
                    inner = evolve(structure, inner);
                }
                for (const [k, [r, i]] of inner) {
                    accumulate(out, k, r, i);
                }
                break;
            }
            case 'xorParity': {
                let parity = 0;
                for (let bits = index & op.mask; bits !== 0; bits &= bits - 1) {
                    parity ^= 1;
                }
                accumulate(out, index ^ (parity << op.target), re, im);
                break;
            }
            default:
                throw new Error(`Unknown column piece: ${op.kind}`);
        }
    }
    return out;
}

/**
 * Applies a whole column to a sparse state: setup, then the gates where the controls allow -
 * everywhere else the column is the identity - then cleanup.
 *
 * @param {!ColumnStructure} structure
 * @param {!Map.<!int, !Array.<!number>>} amplitudes
 * @returns {!Map.<!int, !Array.<!number>>}
 */
function evolve(structure, amplitudes) {
    for (const op of structure.setup) {
        amplitudes = applyOp(op, amplitudes);
    }
    let acted = new Map();
    const passed = [];
    for (const [index, amp] of amplitudes) {
        if ((index & structure.inclusionMask) === structure.desiredValueMask) {
            acted.set(index, amp);
        } else {
            passed.push([index, amp]);
        }
    }
    for (const op of structure.core) {
        acted = applyOp(op, acted);
    }
    for (const [index, [re, im]] of passed) {
        accumulate(acted, index, re, im);
    }
    amplitudes = acted;
    for (const op of structure.cleanup) {
        amplitudes = applyOp(op, amplitudes);
    }
    return amplitudes;
}

export {evolve};
