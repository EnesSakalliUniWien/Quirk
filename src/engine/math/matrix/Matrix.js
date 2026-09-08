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

import { Complex } from "../complex/Complex.js";
import { ComplexFormula } from "../formula/ComplexFormula.js";
import { ReadableJson } from "./ReadableJson.js";
import { DetailedError } from "../../../base/DetailedError.js";
import { Format } from "../../../base/Format.js";
import { Util } from "../../../base/Util.js";

/**
 * A matrix of complex values.
 * @class
 */
class Matrix {
  /**
   * @param {int} width
   * @param {int} height
   * @param {!Float64Array|!Float32Array} buffer Complex value data, packed row-wise with real and imaginary
   * coefficients interleaved.
   */
  constructor(width, height, buffer) {
    if (width * height * 2 !== buffer.length) {
      throw new DetailedError("width*height*2 !== buffer.length", {
        width,
        height,
        len: buffer.length,
      });
    }
    /**
     * @type {int}
     * @private
     */
    this._width = width;
    /**
     * @type {int}
     * @private
     */
    this._height = height;
    /**
     * @type {!Float32Array|!Float64Array}
     * @private
     */
    this._buffer = buffer;
  }

  /**
   * @param {int} col
   * @param {int} row
   * @returns {!Complex}
   */
  cell(col, row) {
    if (col < 0 || row < 0 || col >= this._width || row >= this._height) {
      throw new DetailedError("Cell out of range", {
        col,
        row,
        width: this._width,
        height: this._height,
      });
    }
    const i = (this._width * row + col) * 2;
    return new Complex(this._buffer[i], this._buffer[i + 1]);
  }

  /**
   * @returns {!Float64Array|!Float32Array}
   */
  rawBuffer() {
    return this._buffer;
  }

  /**
   * Encodes the matrix into JSON that could easily be read by humans or processed by external programs.
   * @returns {*}
   */
  toReadableJson() {
    return this.rows().map((e) => ReadableJson.complexVector(e));
  }
  /**
   * @returns {!Array.<!Array.<Complex>>}
   */
  rows() {
    return Array.from({ length: this._height }, (_, row) =>
      Array.from({ length: this._width }, (_, col) => this.cell(col, row)),
    );
  }

  /**
   * @param rows {!Array.<!Array.<Complex>>} The rows of complex coefficients making up the matrix.
   */
  static fromRows(rows) {
    Util.need(
      Array.isArray(rows) && rows.every(Array.isArray),
      "array rows",
      rows,
    );
    Util.need(rows.length > 0, "non-zero height", {rows});

    const h = rows.length;
    const widths = new Set(rows.map((e) => e.length));
    const w = widths.size === 1 ? [...widths][0] : null;
    if (w === null) {
      throw new DetailedError("Inconsistent row widths.", { rows });
    }

    const buffer = new Float64Array(w * h * 2);
    let i = 0;
    for (const row of rows) {
      for (const cell of row) {
        buffer[i] = Complex.realPartOf(cell);
        buffer[i + 1] = Complex.imagPartOf(cell);
        i += 2;
      }
    }
    return new Matrix(w, h, buffer);
  }

  /**
   * Determines if the receiving matrix is equal to the given matrix.
   * This method returns false, instead of throwing, when given badly typed arguments.
   * @param {!Matrix|*} obj
   * @returns {!boolean}
   */
  isEqualTo(obj) {
    if (this === obj) {
      return true;
    }
    if (!(obj instanceof Matrix)) {
      return false;
    }

    /** @type {!Matrix} */
    const other = obj;
    return (
      this._width === other._width &&
      this._height === other._height &&
      this._buffer.every((e, i) => e === other._buffer[i])
    );
  }

  /**
   * Determines if the receiving matrix is approximately equal to the given matrix.
   * @param {!Matrix|*} other
   * @param {!number} epsilon Maximum distance between the two matrices.
   * @returns {!boolean}
   */
  isApproximatelyEqualTo(other, epsilon) {
    return (
      other instanceof Matrix &&
      this._width === other._width &&
      this._height === other._height &&
      Math.sqrt(this.minus(other).norm2()) <= epsilon
    );
  }

  /**
   * Returns a text representation of the receiving matrix.
   * (It uses curly braces so you can paste it into wolfram alpha.)
   * @param {=Format} format
   * @returns {!string}
   */
  toString(format = Format.EXACT) {
    const data = this.rows()
      .map((row) =>
        row.map((e) => e.toString(format)).join(format.itemSeparator),
      )
      .join("}" + format.itemSeparator + "{");
    return "{{" + data + "}}";
  }

  /**
   * @param {!string} text
   * @returns {!Matrix}
   * @throws
   */
  static parse(text) {
    text = text.replace(/\s/g, "");

    if (
      text.length < 4 ||
      text.slice(0, 2) !== "{{" ||
      text.slice(-2) !== "}}"
    ) {
      throw new Error("Not surrounded by {{}}.");
    }

    // Some kind of recursive descent parser would be a better idea, but here we are.
    return Matrix.fromRows(
      text
        .slice(2, text.length - 2)
        .split("},{")
        .map((row) => row.split(",").map((cell) => ComplexFormula.parse(cell))),
    );
  }

  /**
   * Returns a matrix of the given dimensions, using the given function to generate the coefficients.
   * @param {!int} width
   * @param {!int} height
   * @param {!function(row: !int, col: !int): (!number|!Complex)} coefficientRowColGenerator
   * @returns {!Matrix}
   */
  static generate(width, height, coefficientRowColGenerator) {
    const buf = new Float64Array(width * height * 2);
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const k = (r * width + c) * 2;
        const v = coefficientRowColGenerator(r, c);
        buf[k] = Complex.realPartOf(v);
        buf[k + 1] = Complex.imagPartOf(v);
      }
    }
    return new Matrix(width, height, buf);
  }

  /**
   * Returns a diagonal matrix of the given size, using the given function to generate the diagonal coefficients.
   * @param {!int} size
   * @param {!function(!int): (!number|!Complex)} coefficientFunc
   * @returns {!Matrix}
   */
  static generateDiagonal(size, coefficientFunc) {
    const buf = new Float64Array(size * size * 2);
    for (let i = 0; i < size; i++) {
      const k = i * (size + 1) * 2;
      const v = coefficientFunc(i);
      buf[k] = Complex.realPartOf(v);
      buf[k + 1] = Complex.imagPartOf(v);
    }
    return new Matrix(size, size, buf);
  }

  /**
   * Returns a matrix of the given size, with each column being mapped to a row by the transition function.
   * @param {!int} size
   * @param {!function(!int): !int} transitionFunc
   * @returns {!Matrix}
   */
  static generateTransition(size, transitionFunc) {
    const buf = new Float64Array(size * size * 2);
    for (let c = 0; c < size; c++) {
      const r = transitionFunc(c);
      const k = (r * size + c) * 2;
      buf[k] = 1;
    }
    return new Matrix(size, size, buf);
  }

  /**
   * Returns a zero matrix of the given size.
   * @param {!number} width
   * @param {!number} height
   * @returns {!Matrix}
   */
  static zero(width, height) {
    return new Matrix(width, height, new Float64Array(width * height * 2));
  }

  /**
   * Converts the given square block of coefficients into a square complex matrix.
   * @param {!number|!Complex} coefs The coefficients of the matrix,
   * arranged in a flat array of square length with the coefficients (which can be numeric or complex) in row order.
   * @returns {!Matrix}
   */
  static square(...coefs) {
    Util.need(Array.isArray(coefs), "Array.isArray(coefs)", {coefs});
    const n = Math.round(Math.sqrt(coefs.length));
    Util.need(
      n * n === coefs.length,
      "Matrix.square: non-square number of arguments",
    );
    return Matrix.generate(n, n, (r, c) => coefs[r * n + c]);
  }

  /**
   * Converts the array of complex coefficients into a column vector.
   * @param {!number|!Complex} coefs
   * @returns {!Matrix}
   */
  static col(...coefs) {
    Util.need(Array.isArray(coefs), "Array.isArray(coefs)", {coefs});
    return Matrix.generate(1, coefs.length, (r) => coefs[r]);
  }

  /**
   * Returns the width of the receiving matrix.
   * @returns {!int}
   */
  width() {
    return this._width;
  }

  /**
   * Returns the height of the receiving matrix.
   * @returns {!int}
   */
  height() {
    return this._height;
  }

  /**
   * Determines if the matrix is approximately unitary or not.
   * @param {!number} epsilon Distance away from unitary the matrix is allowed to be. Defaults to 0.
   * @returns {!boolean}
   */
  isUnitary(epsilon) {
    const n = this.width();
    if (this.height() !== n) {
      return false;
    }
    return this.times(this.adjoint()).isApproximatelyEqualTo(
      Matrix.identity(n),
      epsilon,
    );
  }

  /**
   * Determines if the matrix can be factored into a permutation matrix times a diagonal matrix.
   * @param {!number=} epsilon
   * @returns {!boolean}
   */
  isPhasedPermutation(epsilon = 0) {
    if (this._width !== this._height) {
      return false;
    }

    const n = this._width;
    const colCounts = new Uint32Array(n);
    const rowCounts = new Uint32Array(n);

    // Count number of non-zero elements in each row and column.
    for (let col = 0; col < n; col++) {
      for (let row = 0; row < n; row++) {
        const i = (row * n + col) * 2;
        const m = Math.max(
          Math.abs(this._buffer[i]),
          Math.abs(this._buffer[i + 1]),
        );
        if (Number.isNaN(m) || m > epsilon) {
          colCounts[col] += 1;
          rowCounts[row] += 1;
        }
      }
    }

    // Phased permutations have at most one entry in each row and column.
    return [...colCounts, ...rowCounts].every((e) => e <= 1);
  }

  /**
   * Determines if the matrix is approximately equal to its own conjugate transpose or not.
   * @param {!number} epsilon Maximum error per entry.
   * @returns {!boolean}
   */
  isApproximatelyHermitian(epsilon) {
    if (this._width !== this._height) {
      return false;
    }
    for (let c = 0; c < this._width; c++) {
      for (let r = 0; r < this._height; r++) {
        const i = (this._width * r + c) * 2;
        const j = (this._width * c + r) * 2;
        if (Math.abs(this._buffer[i] - this._buffer[j]) > epsilon) {
          return false;
        }
        if (Math.abs(this._buffer[i + 1] + this._buffer[j + 1]) > epsilon) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Determines if the matrix is an identity matrix.
   * @param {!number} epsilon
   * @returns {!boolean}
   */
  isIdentity(epsilon = 0) {
    if (this._width !== this._height) {
      return false;
    }
    for (let c = 0; c < this._width; c++) {
      for (let r = 0; r < this._height; r++) {
        const i = (this._width * r + c) * 2;
        const dr = Math.abs(this._buffer[i] - (r === c ? 1 : 0));
        const di = Math.abs(this._buffer[i + 1]);
        if (Math.max(dr, di) > epsilon) {
          return false;
        }
      }
    }
    return !this.hasNaN();
  }

  /**
   * Determines if the matrix is a scaled identity matrix.
   * @param {!number} epsilon
   * @returns {!boolean}
   */
  isScaler(epsilon = 0) {
    if (this._width !== this._height) {
      return false;
    }
    const sr = this._buffer[0];
    const si = this._buffer[1];
    for (let c = 0; c < this._width; c++) {
      for (let r = 0; r < this._height; r++) {
        const i = (this._width * r + c) * 2;
        const dr = Math.abs(this._buffer[i] - (r === c ? sr : 0));
        const di = Math.abs(this._buffer[i + 1] - (r === c ? si : 0));
        if (Math.max(dr, di) > epsilon) {
          return false;
        }
      }
    }
    return !this.hasNaN();
  }

  /**
   * Determines if the matrix contains a NaN.
   * @returns {!boolean}
   */
  hasNaN() {
    for (let i = 0; i < this._buffer.length; i++) {
      if (Number.isNaN(this._buffer[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Determines if the matrix is square and only has entries along its main diagonal.
   * @param {!number=} epsilon
   * @returns {!boolean}
   */
  isDiagonal(epsilon = 0) {
    for (let c = 0; c < this._width; c++) {
      for (let r = 0; r < this._height; r++) {
        if (r === c) {
          continue;
        }
        const k = (this._width * r + c) * 2;
        const dr = Math.abs(this._buffer[k]);
        const di = Math.abs(this._buffer[k + 1]);
        const d = Math.max(dr, di);
        if (Number.isNaN(d) || d > epsilon) {
          return false;
        }
      }
    }
    return this._width === this._height;
  }

  /**
   * Returns the conjugate transpose of the receiving operation (the adjoint is the inverse when the matrix is unitary).
   * @returns {!Matrix}
   */
  adjoint() {
    const w = this._height;
    const h = this._width;
    const newBuf = new Float64Array(w * h * 2);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const kIn = (c * this._width + r) * 2;
        const kOut = (r * w + c) * 2;
        newBuf[kOut] = this._buffer[kIn];
        newBuf[kOut + 1] = -this._buffer[kIn + 1];
      }
    }
    return new Matrix(w, h, newBuf);
  }

  /**
   * @returns {!Matrix} The transpose of the receiving matrix.
   */
  transpose() {
    const w = this._height;
    const h = this._width;
    const newBuf = new Float64Array(w * h * 2);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const kIn = (c * this._width + r) * 2;
        const kOut = (r * w + c) * 2;
        newBuf[kOut] = this._buffer[kIn];
        newBuf[kOut + 1] = this._buffer[kIn + 1];
      }
    }
    return new Matrix(w, h, newBuf);
  }

  /**
   * Returns the matrix' trace (i.e. the sum of its diagonal elements, i.e. the sum of its eigenvalues
   * if it's square).
   * @returns {!Complex}
   */
  trace() {
    let total_r = 0;
    let total_i = 0;
    const d = this._width * 2 + 2;
    for (let i = 0; i < this._buffer.length; i += d) {
      total_r += this._buffer[i];
      total_i += this._buffer[i + 1];
    }
    return new Complex(total_r, total_i);
  }

  /**
   * Returns the result of scaling the receiving matrix by the given scalar factor.
   * @param {!number|!Complex} v
   * @returns {!Matrix}
   * @private
   */
  _timesScalar(v) {
    const newBuffer = new Float64Array(this._buffer.length);
    const sr = Complex.realPartOf(v);
    const si = Complex.imagPartOf(v);
    for (let i = 0; i < newBuffer.length; i += 2) {
      const vr = this._buffer[i];
      const vi = this._buffer[i + 1];
      newBuffer[i] = vr * sr - vi * si;
      newBuffer[i + 1] = vr * si + vi * sr;
    }
    return new Matrix(this._width, this._height, newBuffer);
  }

  /**
   * Returns the sum of the receiving matrix and the given matrix.
   * @param {!Matrix} other
   * @returns {!Matrix}
   */
  plus(other) {
    const { _width: w, _height: h, _buffer: b1 } = this;
    const b2 = other._buffer;
    Util.need(
      other._width === w && other._height === h,
      "Matrix.plus: compatible sizes",
    );

    const newBuffer = new Float64Array(this._buffer.length);
    for (let i = 0; i < newBuffer.length; i++) {
      newBuffer[i] = b1[i] + b2[i];
    }
    return new Matrix(w, h, newBuffer);
  }

  /**
   * Returns the difference from the receiving matrix to the given matrix.
   * @param {!Matrix} other
   * @returns {!Matrix}
   */
  minus(other) {
    const { _width: w, _height: h, _buffer: b1 } = this;
    const b2 = other._buffer;
    Util.need(
      other._width === w && other._height === h,
      "Matrix.minus: compatible sizes",
    );

    const newBuffer = new Float64Array(this._buffer.length);
    for (let i = 0; i < newBuffer.length; i++) {
      newBuffer[i] = b1[i] - b2[i];
    }
    return new Matrix(w, h, newBuffer);
  }

  /**
   * Returns the matrix product (i.e. the composition) of the receiving matrix and the given matrix.
   * @param {!Matrix} other
   * @returns {!Matrix}
   * @private
   */
  _timesMatrix(other) {
    if (this._width !== other._height) {
      throw new DetailedError("Incompatible sizes.", { this: this, other });
    }
    const w = other._width;
    const h = this._height;
    const n = this._width;
    const newBuffer = new Float64Array(w * h * 2);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const k3 = (r * w + c) * 2;
        for (let k = 0; k < n; k++) {
          const k1 = (r * n + k) * 2;
          const k2 = (k * w + c) * 2;
          const r1 = this._buffer[k1];
          const i1 = this._buffer[k1 + 1];
          const r2 = other._buffer[k2];
          const i2 = other._buffer[k2 + 1];
          const r3 = r1 * r2 - i1 * i2;
          const i3 = r1 * i2 + r2 * i1;
          newBuffer[k3] += r3;
          newBuffer[k3 + 1] += i3;
        }
      }
    }
    return new Matrix(w, h, newBuffer);
  }

  /**
   * Returns the product of the receiving matrix and the given matrix or scalar.
   * @param {!Matrix|!number|!Complex} other A matrix or a scalar value.
   * @returns {!Matrix}
   */
  times(other) {
    return other instanceof Matrix
      ? this._timesMatrix(other)
      : this._timesScalar(other);
  }

  /**
   * Returns the receiving matrix's squared euclidean length.
   * @returns {!number}
   */
  norm2() {
    let t = 0;
    for (const e of this._buffer) {
      t += e * e;
    }
    return t;
  }

  /**
   * Returns a copy of the matrix with the given function applied to every real and imaginary component.
   * @param {!function(!number) : !number} func
   * @returns {!Matrix}
   */
  transformRealAndImagComponentsWith(func) {
    const buf = this._buffer.slice();
    for (let i = 0; i < buf.length; i++) {
      buf[i] = func(buf[i]);
    }
    return new Matrix(this._width, this._height, buf);
  }

  /**
   * Returns the identity matrix, with 1s on the main diagonal and all other entries zero.
   * @param size The dimension of the returned identity matrix.
   * @returns {!Matrix}
   */
  static identity(size) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new DetailedError("Bad size", { size });
    }
    const buf = new Float64Array(size * size * 2);
    for (let k = 0; k < size; k++) {
      buf[k * (size + 1) * 2] = 1;
    }
    return new Matrix(size, size, buf);
  }

  /**
   * Returns a rotation matrix that rotations by the given angle.
   * @param {!number} theta The angle the matrix should rotate by, in radians.
   * @returns {!Matrix} A real matrix.
   */
  static rotation(theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return Matrix.square(c, -s, s, c);
  }

  /**
   * Computes the cross product of two 3d column vectors.
   * @param {!Matrix} other
   * @returns {!Matrix}
   */
  cross3(other) {
    Util.need(
      this.width() === 1 && this.height() === 3,
      "This isn't a 3d column vector.",
    );
    Util.need(
      other.width() === 1 && other.height() === 3,
      "Other's not a 3d column vector.",
    );
    return Matrix.generate(1, 3, (r) => {
      const [i, j] = [(r + 1) % 3, (r + 2) % 3];
      const a = this.cell(0, i).times(other.cell(0, j));
      const b = this.cell(0, j).times(other.cell(0, i));
      return a.minus(b);
    });
  }

  /**
   * @param {!int} colIndex
   * @returns {!Array.<!Complex>}
   */
  getColumn(colIndex) {
    Util.need(
      colIndex >= 0 && colIndex <= this.width(),
      "colIndex >= 0 && colIndex <= this.width()",
    );
    const col = [];
    for (let r = 0; r < this._height; r++) {
      col.push(this.cell(colIndex, r));
    }
    return col;
  }
}

export { Matrix };
