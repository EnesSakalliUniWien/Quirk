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

// Matrix and Complex operations that only the tests need. They used to live on the production
// classes; they build expected values the CPU way so the GPU simulation has something to agree with.

import {Util} from "../src/base/Util.js"
import {Complex} from "../src/engine/math/complex/Complex.js"
import {Matrix} from "../src/engine/math/matrix/Matrix.js"
import {QubitMatrix} from "../src/engine/math/matrix/QubitMatrix.js"

/**
 * Returns the square roots of a complex number.
 * @param {!Complex} z
 * @returns {!Array.<!Complex>}
 */
function sqrts(z) {
    let [r, i] = [z.real, z.imag];
    let m = Math.sqrt(Math.sqrt(r * r + i * i));
    if (m === 0) {
        return [Complex.ZERO];
    }
    if (i === 0 && r < 0) {
        return [new Complex(0, m), new Complex(0, -m)];
    }

    let a = z.phase() / 2;
    let c = Complex.polar(m, a);
    return [c, c.times(-1)];
}

/**
 * Returns the distinct roots of the quadratic, or linear, equation.
 * @param {!number|!Complex} a
 * @param {!number|!Complex} b
 * @param {!number|!Complex} c
 * @returns {!Array.<!Complex>}
 */
function rootsOfQuadratic(a, b, c) {
    a = Complex.from(a);
    b = Complex.from(b);
    c = Complex.from(c);

    if (a.isEqualTo(0)) {
        if (!b.isEqualTo(0)) {
            return [c.times(-1).dividedBy(b)];
        }
        if (!c.isEqualTo(0)) {
            return [];
        }
        throw Error("Degenerate");
    }

    let difs = sqrts(b.times(b).minus(a.times(c).times(4)));
    let mid = b.times(-1);
    let denom = a.times(2);
    return difs.map(d => mid.minus(d).dividedBy(denom));
}

/**
 * @param {!Matrix} m A 2x2 matrix.
 * @returns {!Array.<!Complex>} The cells [a, b, c, d] of {{a, b}, {c, d}}.
 */
function cells2x2(m) {
    return [m.cell(0, 0), m.cell(1, 0), m.cell(0, 1), m.cell(1, 1)];
}

/**
 * Computes the eigenvalues and eigenvectors of a 2x2 matrix.
 * @param {!Matrix} m
 * @returns {!Array.<!{val: !Complex, vec: !Matrix}>}
 */
function eigenDecomposition(m) {
    if (m.width() !== 2 || m.height() !== 2) {
        throw new Error("Not implemented: non-2x2 eigen decomposition");
    }
    let [a, b, c, d] = cells2x2(m);
    let vals = rootsOfQuadratic(Complex.ONE, a.plus(d).times(-1), a.times(d).minus(b.times(c)));
    if (vals.length === 0) {
        throw new Error("Degenerate");
    }
    if (vals.length === 1) {
        return [
            {val: vals[0], vec: Matrix.col(1, 0)},
            {val: vals[0], vec: Matrix.col(0, 1)}
        ];
    }
    return vals.map(v => {
        // x*(a-L) + y*b = 0
        let [x, y] = [b.times(-1), a.minus(v)];
        if (x.isEqualTo(0) && y.isEqualTo(0)) {
            [x, y] = [v.minus(d), c];
        }
        if (!x.isEqualTo(0)) {
            y = y.dividedBy(x);
            x = Complex.ONE;
        }
        let n = Math.sqrt(x.norm2() + y.norm2());
        if (n === 0) {
            throw new Error("Unexpected degenerate");
        }
        return {val: v, vec: Matrix.col(x, y).times(1 / n)};
    });
}

/**
 * Lifts a numeric function so that it applies to matrices by using the eigendecomposition and applying the function
 * to the eigenvalue coefficients.
 * @param {!Matrix} m
 * @param {!function(!Complex) : !Complex} complexFunction
 * @returns {!Matrix}
 */
function liftApply(m, complexFunction) {
    let t = m.times(0);
    for (let {val, vec} of eigenDecomposition(m)) {
        let fVal = complexFunction(val);
        let part = vec.times(vec.adjoint());
        t = t.plus(part.times(fVal));
    }
    return t;
}

/**
 * Returns the square matrix' determinant (i.e. the product of its eigenvalues).
 * @param {!Matrix} m
 * @returns {!Complex}
 */
function determinant(m) {
    Util.need(m.width() === m.height(), "Must be square");
    let n = m.width();
    if (n === 1) {
        return m.cell(0, 0);
    }
    return Array.from({length: n}, (_, k) => {
            let cutColMatrix = Matrix.generate(n - 1, n - 1, (r, c) => m.cell(c + (c < k ? 0 : 1), r + 1));
            return determinant(cutColMatrix).times(m.cell(k, 0)).times(Math.pow(-1, k));
        }).
        reduce((a, e) => a.plus(e), Complex.ZERO);
}

/**
 * Returns the tensor product of two matrices.
 * @param {!Matrix} m1
 * @param {!Matrix} m2
 * @returns {!Matrix}
 */
function tensorProduct(m1, m2) {
    let w1 = m1.width();
    let h1 = m1.height();
    let w2 = m2.width();
    let h2 = m2.height();
    let w = w1 * w2;
    let h = h1 * h2;
    let buf1 = m1.rawBuffer();
    let buf2 = m2.rawBuffer();
    let newBuffer = new Float64Array(w * h * 2);
    for (let r1 = 0; r1 < h1; r1++) {
        for (let r2 = 0; r2 < h2; r2++) {
            for (let c1 = 0; c1 < w1; c1++) {
                for (let c2 = 0; c2 < w2; c2++) {
                    let k1 = (r1 * w1 + c1) * 2;
                    let k2 = (r2 * w2 + c2) * 2;
                    let k3 = ((r1 * h2 + r2) * w + (c1 * w2 + c2)) * 2;
                    let cr1 = buf1[k1];
                    let ci1 = buf1[k1 + 1];
                    let cr2 = buf2[k2];
                    let ci2 = buf2[k2 + 1];
                    newBuffer[k3] = cr1 * cr2 - ci1 * ci2;
                    newBuffer[k3 + 1] = cr1 * ci2 + ci1 * cr2;
                }
            }
        }
    }
    return new Matrix(w, h, newBuffer);
}

/**
 * Expands a qubit operation so that it applies to a larger register of qubits, with optional controls.
 * @param {!Matrix} operation
 * @param {!int} targetQubitOffset
 * @param {!int} registerSize
 * @param {!Controls} controls
 * @returns {!Matrix}
 */
function expandedForQubitInRegister(operation, targetQubitOffset, registerSize, controls) {
    let used = Math.round(Math.log2(operation.width()));
    let expanded = tensorProduct(
        tensorProduct(Matrix.identity(1 << (registerSize - targetQubitOffset - used)), operation),
        Matrix.identity(1 << targetQubitOffset));
    let w = expanded.width();
    let h = expanded.height();
    let buf = expanded.rawBuffer().slice();

    for (let c = 0; c < w; c++) {
        for (let r = 0; r < h; r++) {
            if (!controls.allowsState(c) || !controls.allowsState(r)) {
                let k = 2 * (c + r * w);
                buf[k] = c === r ? 1 : 0;
                buf[k + 1] = 0;
            }
        }
    }

    return new Matrix(w, h, buf);
}

/**
 * @param {!Matrix} operation
 * @param {!Matrix} stateVector
 * @param {!int} qubitIndex
 * @param {!Controls} controls
 * @returns {!Matrix}
 */
function applyToStateVectorAtQubitWithControls(operation, stateVector, qubitIndex, controls) {
    let stateBuf = stateVector.rawBuffer();
    let chunkSize = operation.width() * 2;
    let chunkBuf = stateBuf.slice(0, chunkSize);
    let strideLength = 2 << qubitIndex;
    let strideChunkSize = (strideLength * chunkSize) >> 1;
    let resultBuf = stateBuf.slice();
    for (let strideChunkStart = 0; strideChunkStart < resultBuf.length; strideChunkStart += strideChunkSize) {
        for (let strideOffset = 0; strideOffset < strideLength; strideOffset += 2) {
            if (!controls.allowsState((strideChunkStart | strideOffset) >> 1)) {
                continue;
            }

            // Collect inputs into a small contiguous vector.
            let k = strideChunkStart + strideOffset;
            for (let i = 0; i < chunkBuf.length; i += 2) {
                chunkBuf[i] = stateBuf[k];
                chunkBuf[i + 1] = stateBuf[k + 1];
                k += strideLength;
            }

            let transformedChunk = operation.times(new Matrix(1, chunkBuf.length >> 1, chunkBuf)).rawBuffer();

            // Scatter outputs.
            k = strideChunkStart + strideOffset;
            for (let i = 0; i < chunkBuf.length; i += 2) {
                resultBuf[k] = transformedChunk[i];
                resultBuf[k + 1] = transformedChunk[i + 1];
                k += strideLength;
            }
        }
    }
    return new Matrix(1, stateVector.height(), resultBuf);
}

/**
 * Returns the matrix U = exp(i φ) (I cos(θ/2) - v σ i sin(θ/2)).
 * @param {!number} angle
 * @param {!Array.<!number>} axis
 * @param {!number} phase
 * @returns {!Matrix}
 */
function fromAngleAxisPhaseRotation(angle, axis, phase) {
    let [x, y, z] = axis;
    Util.need(Math.abs(x * x + y * y + z * z - 1) < 0.000001, "Not a unit axis.");

    let vσ = QubitMatrix.PAULI_X.times(x).
        plus(QubitMatrix.PAULI_Y.times(y)).
        plus(QubitMatrix.PAULI_Z.times(z));
    let [cos, sin] = Util.snappedCosSin(-angle / 2);
    return Matrix.identity(2).times(cos).
        plus(vσ.times(new Complex(0, sin))).
        times(Complex.polar(1, phase));
}

/**
 * @param {!Matrix} m
 * @param {!number=} epsilon
 * @returns {!boolean}
 */
function isUpperTriangular(m, epsilon = 0) {
    let w = m.width();
    let buf = m.rawBuffer();
    for (let r = 0; r < m.height(); r++) {
        for (let c = 0; c < r && c < w; c++) {
            let k = (r * w + c) * 2;
            let v1 = buf[k];
            let v2 = buf[k + 1];
            if (isNaN(v1) || isNaN(v2) || v1 * v1 + v2 * v2 > epsilon * epsilon) {
                return false;
            }
        }
    }
    return true;
}

/**
 * @param {!Matrix} m
 * @param {!number=} epsilon
 * @returns {!boolean}
 */
function isLowerTriangular(m, epsilon = 0) {
    let w = m.width();
    let buf = m.rawBuffer();
    for (let r = 0; r < m.height(); r++) {
        for (let c = r + 1; c < w; c++) {
            let k = (r * w + c) * 2;
            let v1 = buf[k];
            let v2 = buf[k + 1];
            if (isNaN(v1) || isNaN(v2) || v1 * v1 + v2 * v2 > epsilon * epsilon) {
                return false;
            }
        }
    }
    return true;
}

export {
    sqrts,
    rootsOfQuadratic,
    eigenDecomposition,
    liftApply,
    determinant,
    tensorProduct,
    expandedForQubitInRegister,
    applyToStateVectorAtQubitWithControls,
    fromAngleAxisPhaseRotation,
    isUpperTriangular,
    isLowerTriangular,
};
