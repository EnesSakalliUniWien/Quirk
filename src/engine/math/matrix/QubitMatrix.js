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
import { Format } from "../../../base/Format.js";
import { seq } from "../../../base/Seq.js";
import { snappedCosSin } from "../trigonometry.js";
import { need } from "../../../base/preconditions.js";
import { Complex } from "../complex/Complex.js";
import { Matrix } from "./Matrix.js";

/**
 * Single-qubit matrices and the conversions between 2x2 matrices, rotations and Bloch vectors.
 *
 * Everything here is a pure function of matrices; the circuit layer decides where it applies.
 */
class QubitMatrix {
  /**
   * @param {!Matrix} m A 2x2 matrix.
   * @returns {!Array.<!Complex>} The cells [a, b, c, d] of {{a, b}, {c, d}}.
   * @private
   */
  static _cells2x2(m) {
    return [m.cell(0, 0), m.cell(1, 0), m.cell(0, 1), m.cell(1, 1)];
  }

  /**
   * Returns a single-qubit quantum operation corresponding to the given 3-dimensional rotation in some useful way.
   *
   * The mapping is chosen so that rotating around each axis runs through the respective pauli matrix, and so that cutting
   * a rotation in half square roots the result, and a few other nice properties.
   *
   * The direction of the given x, y, z vector determines which axis to rotate around, and the length of the vector
   * determines what fraction of an entire turn to rotate. For example, if [x, y, z] is [1/√8), 0, 1/√8], then the
   * rotation is a half-turn around the X+Z axis and the resulting operation is the Hadamard operation
   * {{1, 1}, {1, -1}}/√2.
   *
   * @param {!number} x The x component of the rotation vector.
   * @param {!number} y The y component of the rotation vector.
   * @param {!number} z The z component of the rotation vector.
   *
   * @returns {!Matrix}
   */
  static fromPauliRotation(x, y, z) {
    const sinc = (t) => {
      if (Math.abs(t) < 0.0002) {
        return 1 - (t * t) / 6.0;
      }
      return Math.sin(t) / t;
    };

    x = -x * Math.PI * 2;
    y = -y * Math.PI * 2;
    z = -z * Math.PI * 2;

    const s = -11 * x + -13 * y + -17 * z >= 0 ? 1 : -1; // phase correction discontinuity on an awkward plane
    const theta = Math.sqrt(x * x + y * y + z * z);
    const sigma_v = QubitMatrix.PAULI_X.times(x)
      .plus(QubitMatrix.PAULI_Y.times(y))
      .plus(QubitMatrix.PAULI_Z.times(z));

    /** @type {!Complex} */
    const [cos, sin] = snappedCosSin(s * theta);
    const ci = new Complex(1 + cos, sin).times(0.5);
    /** @type {!Complex} */
    const cv = new Complex(
      Math.sin(theta / 2) * sinc(theta / 2),
      -s * sinc(theta),
    ).times(s * 0.5);

    const m = Matrix.identity(2).times(ci).minus(sigma_v.times(cv));
    const expectNiceValuesCorrection = (v) =>
      Format.simplifyByRounding(v, 0.0000000000001);
    return m.transformRealAndImagComponentsWith(expectNiceValuesCorrection);
  }

  /**
   * Returns the bloch sphere vector (as an x,y,z array) corresponding to the given density matrix.
   * @param {!Matrix} densityMatrix A 2x2 Hermitian matrix with unit trace.
   * @returns {!Array.<!number>}
   */
  static densityMatrixToBlochVector(densityMatrix) {
    if (densityMatrix.width() !== 2 || densityMatrix.height() !== 2) {
      throw new DetailedError("Need a 2x2 density matrix.", densityMatrix);
    }
    if (!densityMatrix.isApproximatelyHermitian(0.01)) {
      throw new DetailedError(
        "Density matrix should be Hermitian.",
        densityMatrix,
      );
    }
    if (!densityMatrix.trace().isApproximatelyEqualTo(1, 0.01)) {
      throw new DetailedError(
        "Density matrix should have unit trace.",
        densityMatrix,
      );
    }

    // Density matrix from bloch vector equation: M = 1/2 (I + vσ)
    const [ar, , br, bi, cr, ci, dr] = densityMatrix.rawBuffer();
    const x = -cr - br;
    const y = bi - ci;
    const z = dr - ar;
    return [x, y, z];
  }

  /**
   * Given a single-qubit operation matrix U, finds φ, θ, and v=[x,y,z] that satisfy
   * U = exp(i φ) (I cos(θ/2) - v σ i sin(θ/2))
   *
   * @param {!Matrix} operation A 2x2 unitary matrix.
   * @returns {!{axis: !Array.<!number>, angle: !number, phase: !number}}
   */
  static operationToAngleAxisRotation(operation) {
    need(
      operation.width() === 2 && operation.height() === 2,
      "Need a 2x2 matrix.",
    );
    need(operation.isUnitary(0.01), "Need a unitary matrix.");

    // Extract orthogonal components, adjusting for factors of i.
    const [a, b, c, d] = QubitMatrix._cells2x2(operation);
    const wφ = a.plus(d);
    const xφ = b.plus(c).dividedBy(Complex.I);
    const yφ = b.minus(c);
    const zφ = a.minus(d).dividedBy(Complex.I);

    // Cancel global phase factor, pushing all values onto the real line.
    let φ = seq([wφ, xφ, yφ, zφ])
      .maxBy((e) => e.abs())
      .unit()
      .times(2);
    const w = Math.min(1, Math.max(-1, wφ.dividedBy(φ).real));
    let x = xφ.dividedBy(φ).real;
    let y = yφ.dividedBy(φ).real;
    let z = zφ.dividedBy(φ).real;
    let θ = -2 * Math.acos(w);

    // Normalize axis.
    const n = Math.sqrt(x * x + y * y + z * z);
    if (n < 0.0000001) {
      // There's an axis singularity near θ=0. Just default to no rotation around the X axis.
      return { axis: [1, 0, 0], angle: 0, phase: φ.phase() };
    }
    x /= n;
    y /= n;
    z /= n;

    // Prefer θ in [-π, π].
    if (θ <= -Math.PI) {
      θ += 2 * Math.PI;
      φ = φ.times(-1);
    }

    // Prefer axes that point positive-ward.
    if (x + y + z < 0) {
      x = -x;
      y = -y;
      z = -z;
      θ = -θ;
    }

    return { axis: [x, y, z], angle: θ, phase: φ.phase() };
  }
}

/**
 * The 2x2 Pauli X matrix.
 * @type {!Matrix}
 */
QubitMatrix.PAULI_X = Matrix.square(0, 1, 1, 0);

/**
 * The 2x2 Pauli Y matrix.
 * @type {!Matrix}
 */
QubitMatrix.PAULI_Y = Matrix.square(0, new Complex(0, -1), Complex.I, 0);

/**
 * The 2x2 Pauli Z matrix.
 * @type {!Matrix}
 */
QubitMatrix.PAULI_Z = Matrix.square(1, 0, 0, -1);

/**
 * The 2x2 Hadamard matrix.
 * @type {!Matrix}
 */
QubitMatrix.HADAMARD = Matrix.square(1, 1, 1, -1).times(Math.sqrt(0.5));

export { QubitMatrix };
