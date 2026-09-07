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
import { Seq } from "../../../base/Seq.js";
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
    let w = m.width();
    let buf = m.rawBuffer();
    for (let col = 0; col < w; col++) {
      let v = m.cell(col, row).times(scale);
      let k = (row * w + col) * 2;
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
    let w = m.width();
    let buf = m.rawBuffer();
    for (let row = 0; row < m.height(); row++) {
      let v = m.cell(col, row).times(scale);
      let k = (row * w + col) * 2;
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
    let [a, b, c, d] = MatrixDecomposition._cells2x2(op);
    let w = m.width();
    let buf = m.rawBuffer();
    for (let col = 0; col < w; col++) {
      let x = m.cell(col, row1);
      let y = m.cell(col, row2);
      let v1 = x.times(a).plus(y.times(b));
      let v2 = x.times(c).plus(y.times(d));
      let k1 = (row1 * w + col) * 2;
      let k2 = (row2 * w + col) * 2;
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
    let [a, b, c, d] = MatrixDecomposition._cells2x2(op);
    let w = m.width();
    let buf = m.rawBuffer();
    for (let row = 0; row < w; row++) {
      let x = m.cell(col1, row);
      let y = m.cell(col2, row);
      let v1 = x.times(a).plus(y.times(c));
      let v2 = x.times(b).plus(y.times(d));
      let k1 = (row * w + col1) * 2;
      let k2 = (row * w + col2) * 2;
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
    let w = m.width();
    let h = m.height();
    if (w !== h) {
      throw new DetailedError("Expected a square matrix.", m);
    }
    let Q = Matrix.identity(w);
    let R = MatrixDecomposition._clone(m);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < row && col < w; col++) {
        // We're going to cancel out the value below the diagonal with a Givens rotation.

        let belowDiag = R.cell(col, row); // Zero this.
        let onDiag = R.cell(col, col); // With this.

        // Determine how much to rotate.
        let mag1 = onDiag.abs();
        let mag2 = belowDiag.abs();
        if (mag2 === 0) {
          continue; // Already zero'd.
        }
        let theta = -Math.atan2(mag2, mag1);
        let cos = Math.cos(theta);
        let sin = Math.sin(theta);

        // Need to cancel phases before rotating.
        let phase1 = onDiag.unit().conjugate();
        let phase2 = belowDiag.unit().conjugate();

        // Apply the rotation to R (and cancel it with Q).
        let op = Matrix.square(
          phase1.times(cos),
          phase2.times(-sin),
          phase1.times(sin),
          phase2.times(cos),
        );
        MatrixDecomposition._rowMixPreMultiply(R, col, row, op);
        MatrixDecomposition._colMixPostMultiply(Q, col, row, op.adjoint());
      }

      // Cancel imaginary factors on diagonal.
      let u = R.cell(row, row).unit();
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
    let { Q, R } = MatrixDecomposition.qr(m.adjoint());
    return { L: R.adjoint(), Q: Q.adjoint() };
  }

  /**
   * @param {!Matrix} m A 2x2 matrix.
   * @returns {!{U: !Matrix, S: !Matrix, V: !Matrix}}
   * @private
   */
  static _unorderedSvd2x2(m) {
    // Initial dirty work of clearing a corner is handled by the LQ decomposition.
    let U = Matrix.identity(2);
    let { L: S, Q: V } = MatrixDecomposition.lq(m);

    // Cancel phase factors, leaving S with only real entries.
    let au = S.cell(0, 0).unit();
    let cu = S.cell(0, 1).unit();
    MatrixDecomposition._colScalePostMultiply(U, 0, au);
    MatrixDecomposition._colScalePostMultiply(U, 1, cu);
    MatrixDecomposition._rowScalePreMultiply(S, 0, au.conjugate());
    MatrixDecomposition._rowScalePreMultiply(S, 1, cu.conjugate());
    let du = S.cell(1, 1).unit();
    MatrixDecomposition._colScalePostMultiply(S, 1, du.conjugate());
    MatrixDecomposition._rowScalePreMultiply(V, 1, du);

    // Decompose the 2x2 real matrix.
    let [a, , b, , c, , d] = S.rawBuffer();
    let t = a + d;
    let x = b + c;
    let y = b - c;
    let z = a - d;
    let theta_0 = Math.atan2(x, t) / 2.0;
    let theta_d = Math.atan2(y, z) / 2.0;
    let s_0 = Math.sqrt(t * t + x * x) / 2.0;
    let s_d = Math.sqrt(z * z + y * y) / 2.0;
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
      let { Q: Ql, R: Sl } = MatrixDecomposition.qr(S);
      let { L: Sr, Q: Qr } = MatrixDecomposition.lq(Sl);
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
    let n = m.width();
    if (n !== m.height()) {
      throw new DetailedError("Expected a square matrix.", m);
    }

    let { U, S, V } =
      n === 2
        ? MatrixDecomposition._unorderedSvd2x2(m)
        : MatrixDecomposition._unorderedSvdIterative(m, epsilon, maxIterations);

    // Fix ordering, so that the singular values are ascending.
    let sBuf = S.rawBuffer();
    let permutation = Seq.range(n)
      .sortedBy((i) => -S.cell(i, i).norm2())
      .toArray();
    for (let i = 0; i < n; i++) {
      let j = permutation.indexOf(i);
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
        let si = i * (n + 1) * 2;
        let sj = j * (n + 1) * 2;
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
    let svd = MatrixDecomposition.svd(m, epsilon, maxIterations);
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
