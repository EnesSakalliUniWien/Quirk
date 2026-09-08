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

import { DetailedError } from "../../../base/DetailedError.js";
import { Matrix } from "./Matrix.js";

/**
 * Factorizations of square matrices, and the unitary repair built on them.
 *
 * Every method takes the matrix as its first argument and leaves it unchanged.
 */
class MatrixDecomposition {
  /**
   * @param {!Matrix} m
   * @returns {!Matrix} A copy whose buffer can be mutated freely.
   * @private
   */
  static _clone(m) {
    return new Matrix(m.width(), m.height(), m.rawBuffer().slice());
  }

  /**
   * @param {!Matrix} m A 2x2 matrix.
   * @returns {!Array.<!Complex>} The cells [a, b, c, d] of {{a, b}, {c, d}}.
   * @private
   */
  static _cells2x2(m) {
    return [m.cell(0, 0), m.cell(1, 0), m.cell(0, 1), m.cell(1, 1)];
  }

  /**
   * Scales a row in place.
   * @param {!Matrix} m
   * @param {!int} row
   * @param {!Complex} scale
   * @private
   */
  static _rowScalePreMultiply(m, row, scale) {
    const w = m.width();
    const buf = m.rawBuffer();
    for (let col = 0; col < w; col++) {
      const v = m.cell(col, row).times(scale);
      const k = (row * w + col) * 2;
      buf[k] = v.real;
      buf[k + 1] = v.imag;
    }
  }

  /**
   * Scales a column in place.
   * @param {!Matrix} m
   * @param {!int} col
   * @param {!Complex} scale
   * @private
   */
  static _colScalePostMultiply(m, col, scale) {
    const w = m.width();
    const buf = m.rawBuffer();
    for (let row = 0; row < m.height(); row++) {
      const v = m.cell(col, row).times(scale);
      const k = (row * w + col) * 2;
      buf[k] = v.real;
      buf[k + 1] = v.imag;
    }
  }

  /**
   * Applies a 2x2 operation to a pair of rows in place.
   * @param {!Matrix} m
   * @param {!int} row1
   * @param {!int} row2
   * @param {!Matrix} op
   * @private
   */
  static _rowMixPreMultiply(m, row1, row2, op) {
    const [a, b, c, d] = MatrixDecomposition._cells2x2(op);
    const w = m.width();
    const buf = m.rawBuffer();
    for (let col = 0; col < w; col++) {
      const x = m.cell(col, row1);
      const y = m.cell(col, row2);
      const v1 = x.times(a).plus(y.times(b));
      const v2 = x.times(c).plus(y.times(d));
      const k1 = (row1 * w + col) * 2;
      const k2 = (row2 * w + col) * 2;
      buf[k1] = v1.real;
      buf[k1 + 1] = v1.imag;
      buf[k2] = v2.real;
      buf[k2 + 1] = v2.imag;
    }
  }

  /**
   * Applies a 2x2 operation to a pair of columns in place.
   * @param {!Matrix} m
   * @param {!int} col1
   * @param {!int} col2
   * @param {!Matrix} op
   * @private
   */
  static _colMixPostMultiply(m, col1, col2, op) {
    const [a, b, c, d] = MatrixDecomposition._cells2x2(op);
    const w = m.width();
    const buf = m.rawBuffer();
    for (let row = 0; row < w; row++) {
      const x = m.cell(col1, row);
      const y = m.cell(col2, row);
      const v1 = x.times(a).plus(y.times(c));
      const v2 = x.times(b).plus(y.times(d));
      const k1 = (row * w + col1) * 2;
      const k2 = (row * w + col2) * 2;
      buf[k1] = v1.real;
      buf[k1 + 1] = v1.imag;
      buf[k2] = v2.real;
      buf[k2 + 1] = v2.imag;
    }
  }

  /**
   * Factors a square matrix into a unitary matrix Q times an upper diagonal matrix R.
   * @param {!Matrix} m
   * @returns {!{Q: !Matrix, R: !Matrix}} where Q.times(R).isEqualTo(m) && Q.isUnitary() && R.isUpperTriangular()
   */
  static qr(m) {
    const w = m.width();
    const h = m.height();
    if (w !== h) {
      throw new DetailedError("Expected a square matrix.", m);
    }
    const Q = Matrix.identity(w);
    const R = MatrixDecomposition._clone(m);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < row && col < w; col++) {
        // We're going to cancel out the value below the diagonal with a Givens rotation.

        const belowDiag = R.cell(col, row); // Zero this.
        const onDiag = R.cell(col, col); // With this.

        // Determine how much to rotate.
        const mag1 = onDiag.abs();
        const mag2 = belowDiag.abs();
        if (mag2 === 0) {
          continue; // Already zero'd.
        }
        const theta = -Math.atan2(mag2, mag1);
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        // Need to cancel phases before rotating.
        const phase1 = onDiag.unit().conjugate();
        const phase2 = belowDiag.unit().conjugate();

        // Apply the rotation to R (and cancel it with Q).
        const op = Matrix.square(
          phase1.times(cos),
          phase2.times(-sin),
          phase1.times(sin),
          phase2.times(cos),
        );
        MatrixDecomposition._rowMixPreMultiply(R, col, row, op);
        MatrixDecomposition._colMixPostMultiply(Q, col, row, op.adjoint());
      }

      // Cancel imaginary factors on diagonal.
      const u = R.cell(row, row).unit();
      MatrixDecomposition._rowScalePreMultiply(R, row, u.conjugate());
      MatrixDecomposition._colScalePostMultiply(Q, row, u);
    }
    return { Q, R };
  }

  /**
   * Factors a square matrix into a lower diagonal matrix L times a unitary matrix Q.
   * @param {!Matrix} m
   * @returns {!{L: !Matrix, Q: !Matrix}} where L.times(Q).isEqualTo(m) && Q.isUnitary() && L.isLowerTriangular()
   */
  static lq(m) {
    const { Q, R } = MatrixDecomposition.qr(m.adjoint());
    return { L: R.adjoint(), Q: Q.adjoint() };
  }

  /**
   * @param {!Matrix} m A 2x2 matrix.
   * @returns {!{U: !Matrix, S: !Matrix, V: !Matrix}}
   * @private
   */
  static _unorderedSvd2x2(m) {
    // Initial dirty work of clearing a corner is handled by the LQ decomposition.
    const U = Matrix.identity(2);
    let { L: S, Q: V } = MatrixDecomposition.lq(m);

    // Cancel phase factors, leaving S with only real entries.
    const au = S.cell(0, 0).unit();
    const cu = S.cell(0, 1).unit();
    MatrixDecomposition._colScalePostMultiply(U, 0, au);
    MatrixDecomposition._colScalePostMultiply(U, 1, cu);
    MatrixDecomposition._rowScalePreMultiply(S, 0, au.conjugate());
    MatrixDecomposition._rowScalePreMultiply(S, 1, cu.conjugate());
    const du = S.cell(1, 1).unit();
    MatrixDecomposition._colScalePostMultiply(S, 1, du.conjugate());
    MatrixDecomposition._rowScalePreMultiply(V, 1, du);

    // Decompose the 2x2 real matrix.
    const [a, , b, , c, , d] = S.rawBuffer();
    const t = a + d;
    const x = b + c;
    const y = b - c;
    const z = a - d;
    const theta_0 = Math.atan2(x, t) / 2.0;
    const theta_d = Math.atan2(y, z) / 2.0;
    const s_0 = Math.sqrt(t * t + x * x) / 2.0;
    const s_d = Math.sqrt(z * z + y * y) / 2.0;
    MatrixDecomposition._colMixPostMultiply(
      U,
      0,
      1,
      Matrix.rotation(theta_0 - theta_d),
    );
    MatrixDecomposition._rowMixPreMultiply(
      V,
      0,
      1,
      Matrix.rotation(theta_0 + theta_d),
    );
    S = Matrix.square(s_0 + s_d, 0, 0, s_0 - s_d);

    return { U, S, V };
  }

  /**
   * @param {!Matrix} m
   * @param {!number} epsilon
   * @param {!int} maxIterations
   * @returns {!{U: !Matrix, S: !Matrix, V: !Matrix}}
   * @private
   */
  static _unorderedSvdIterative(m, epsilon, maxIterations) {
    let U = Matrix.identity(m.width());
    let S = MatrixDecomposition._clone(m);
    let V = Matrix.identity(m.width());
    let iter = 0;
    while (!S.isDiagonal(epsilon) && iter++ < maxIterations) {
      const { Q: Ql, R: Sl } = MatrixDecomposition.qr(S);
      const { L: Sr, Q: Qr } = MatrixDecomposition.lq(Sl);
      U = U.times(Ql);
      S = Sr;
      V = Qr.times(V);
    }

    return { U, S, V };
  }

  /**
   * Factors a square matrix into u*s*v parts, where u and v are unitary matrices and s is a real diagonal matrix.
   * @param {!Matrix} m
   * @param {!number=} epsilon
   * @param {!int=} maxIterations
   * @returns {!{U: !Matrix, S: !Matrix, V: !Matrix}}
   */
  static svd(m, epsilon = 0, maxIterations = 100) {
    const n = m.width();
    if (n !== m.height()) {
      throw new DetailedError("Expected a square matrix.", m);
    }

    let { U, S, V } =
      n === 2
        ? MatrixDecomposition._unorderedSvd2x2(m)
        : MatrixDecomposition._unorderedSvdIterative(m, epsilon, maxIterations);

    // Fix ordering, so that the singular values are ascending.
    const sBuf = S.rawBuffer();
    const singularity = (i) => -S.cell(i, i).norm2();
    const permutation = Array.from({ length: n }, (_, i) => i).toSorted(
      (a, b) =>
        singularity(a) < singularity(b)
          ? -1
          : singularity(a) > singularity(b)
            ? 1
            : 0,
    );
    for (let i = 0; i < n; i++) {
      const j = permutation.indexOf(i);
      if (i !== j) {
        MatrixDecomposition._colMixPostMultiply(
          U,
          i,
          j,
          MatrixDecomposition._SWAP_2X2,
        );
        MatrixDecomposition._rowMixPreMultiply(
          V,
          i,
          j,
          MatrixDecomposition._SWAP_2X2,
        );
        const si = i * (n + 1) * 2;
        const sj = j * (n + 1) * 2;
        [sBuf[si], sBuf[sj]] = [sBuf[sj], sBuf[si]];
        [sBuf[si + 1], sBuf[sj + 1]] = [sBuf[sj + 1], sBuf[si + 1]];
        [permutation[j], permutation[i]] = [permutation[i], permutation[j]];
      }
    }

    // Fix phases.
    for (let i = 0; i < n; i++) {
      MatrixDecomposition._colScalePostMultiply(U, i, S.cell(i, i).unit());
    }

    // Discard off-diagonal elements.
    S = Matrix.generateDiagonal(n, (k) => S.cell(k, k).abs());

    return { U, S, V };
  }

  /**
   * Returns the unitary matrix closest to the given matrix, "repairing" it into a unitary form.
   * @param {!Matrix} m
   * @param {!number=} epsilon
   * @param {!int=} maxIterations
   * @returns {!Matrix}
   */
  static closestUnitary(m, epsilon = 0, maxIterations = 100) {
    const svd = MatrixDecomposition.svd(m, epsilon, maxIterations);
    return svd.U.times(svd.V);
  }
}

/**
 * The 2x2 permutation that swaps two rows or columns.
 * @type {!Matrix}
 * @private
 */
MatrixDecomposition._SWAP_2X2 = Matrix.square(0, 1, 1, 0);

export { MatrixDecomposition };
