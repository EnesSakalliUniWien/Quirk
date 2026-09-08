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

import {Suite, assertThat, assertTrue, assertFalse} from "../../../TestUtil.js"
import {Matrix} from "../../../../src/engine/math/matrix/Matrix.js"

import {Complex} from "../../../../src/engine/math/complex/Complex.js"
import {Format} from "../../../../src/base/Format.js"
import {tensorProduct} from "../../../MatrixTestUtil.js"
import {QubitMatrix} from "../../../../src/engine/math/matrix/QubitMatrix.js"

const suite = new Suite("Matrix");

suite.test("isEqualTo", () => {
    const m = Matrix.fromRows([[new Complex(2, 3), new Complex(5, 7)], [new Complex(11, 13), new Complex(17, 19)]]);
    assertThat(m).isEqualTo(m);
    assertThat(m).isNotEqualTo(null);
    assertThat(m).isNotEqualTo("");

    assertThat(m).isEqualTo(
        Matrix.fromRows([[new Complex(2, 3), new Complex(5, 7)], [new Complex(11, 13), new Complex(17, 19)]]));
    assertThat(m).isNotEqualTo(
        Matrix.fromRows([[new Complex(2, 3)]]));
    assertThat(m).isNotEqualTo(
        Matrix.fromRows([[new Complex(-2, 3), new Complex(5, 7)], [new Complex(11, 13), new Complex(17, 19)]]));
    assertThat(m).isNotEqualTo(
        Matrix.fromRows([[new Complex(2, 3), new Complex(-5, 7)], [new Complex(11, 13), new Complex(17, 19)]]));
    assertThat(m).isNotEqualTo(
        Matrix.fromRows([[new Complex(2, 3), new Complex(5, 7)], [new Complex(-11, 13), new Complex(17, 19)]]));
    assertThat(m).isNotEqualTo(
        Matrix.fromRows([[new Complex(2, 3), new Complex(5, 7)], [new Complex(11, 13), new Complex(-17, 19)]]));

    const col = Matrix.fromRows([[new Complex(2, 3), new Complex(5, 7)]]);
    const row = Matrix.fromRows([[new Complex(2, 3)], [new Complex(5, 7)]]);
    assertThat(col).isEqualTo(col);
    assertThat(row).isEqualTo(row);
    assertThat(row).isNotEqualTo(col);
});

suite.test("isApproximatelyEqualTo", () => {
    // Size must match
    assertThat(Matrix.fromRows([[1, 1]])).isNotApproximatelyEqualTo(Matrix.col(1, 1), 0);
    assertThat(Matrix.fromRows([[1, 1]])).isNotApproximatelyEqualTo(Matrix.square(1, 1, 1, 1), 0);
    assertThat(Matrix.fromRows([[1, 1]])).isNotApproximatelyEqualTo(Matrix.fromRows([[1, 1, 1]]), 0);
    assertThat(Matrix.fromRows([[1, 1]])).isApproximatelyEqualTo(Matrix.fromRows([[1, 1]]), 0);

    // Error bound matters
    assertThat(Matrix.fromRows([[1]])).isApproximatelyEqualTo(Matrix.fromRows([[1]]), 0);
    assertThat(Matrix.fromRows([[1]])).isApproximatelyEqualTo(Matrix.fromRows([[1]]), 1/4);
    assertThat(Matrix.fromRows([[1.25]])).isApproximatelyEqualTo(Matrix.fromRows([[1]]), 1/4);
    assertThat(Matrix.fromRows([[0.75]])).isApproximatelyEqualTo(Matrix.fromRows([[1]]), 1/4);
    assertThat(Matrix.fromRows([[1.26]])).isNotApproximatelyEqualTo(Matrix.fromRows([[1]]), 1/4);
    assertThat(Matrix.fromRows([[0.74]])).isNotApproximatelyEqualTo(Matrix.fromRows([[1]]), 1/4);

    // Error bound spreads
    assertThat(Matrix.fromRows([[0, 0]])).isApproximatelyEqualTo(Matrix.fromRows([[0, 0]]), 1);
    assertThat(Matrix.fromRows([[1, 0]])).isApproximatelyEqualTo(Matrix.fromRows([[0, 0]]), 1);
    assertThat(Matrix.fromRows([[0, 1]])).isApproximatelyEqualTo(Matrix.fromRows([[0, 0]]), 1);
    assertThat(Matrix.fromRows([[1, 1]])).isNotApproximatelyEqualTo(Matrix.fromRows([[0, 0]]), 1);

    assertThat(Matrix.fromRows([[0]])).isNotApproximatelyEqualTo(null);
    assertThat(Matrix.fromRows([[0]])).isNotApproximatelyEqualTo("");
});

suite.test("toString", () => {
    assertThat(Matrix.fromRows([[2]]).toString()).
        isEqualTo("{{2}}");
    assertThat(Matrix.square(1, 0, new Complex(0, -1), new Complex(2, -3)).toString()).
        isEqualTo("{{1, 0}, {-i, 2-3i}}");
    assertThat(Matrix.square(1, 0, 0, 1).toString()).
        isEqualTo("{{1, 0}, {0, 1}}");
    assertThat(Matrix.identity(3).toString()).
        isEqualTo("{{1, 0, 0}, {0, 1, 0}, {0, 0, 1}}");

    assertThat(Matrix.square(0, 1, new Complex(1/3, 1), new Complex(0, 1/3 + 0.0000001)).toString(Format.EXACT)).
        isEqualTo("{{0, 1}, {\u2153+i, 0.3333334333333333i}}");
    assertThat(Matrix.square(0, 1, new Complex(1/3, 1), new Complex(0, 1/3 + 0.0000001)).toString(Format.SIMPLIFIED)).
        isEqualTo("{{0, 1}, {\u2153+i, \u2153i}}");
    assertThat(Matrix.square(0, 1, new Complex(1/3, 1), new Complex(0, 1/3 + 0.0000001)).toString(Format.MINIFIED)).
        isEqualTo("{{0,1},{\u2153+i,0.3333334333333333i}}");
    assertThat(Matrix.square(0, 1, new Complex(1/3, 1), new Complex(0, 1/3 + 0.0000001)).toString(Format.CONSISTENT)).
        isEqualTo("{{+0.00+0.00i, +1.00+0.00i}, {+0.33+1.00i, +0.00+0.33i}}");
});

suite.test("parse", () => {
    assertThat(Matrix.parse("{{1}}")).isEqualTo(
        Matrix.fromRows([[1]]));
    assertThat(Matrix.parse("{{i}}")).isEqualTo(
        Matrix.fromRows([[Complex.I]]));
    assertThat(Matrix.parse("{{\u221A2}}")).isEqualTo(
        Matrix.square(Math.sqrt(2)));

    assertThat(Matrix.parse("{{½-½i, 5}, {-i, 0}}")).isEqualTo(
        Matrix.square(new Complex(0.5, -0.5), 5, new Complex(0, -1), 0));
    assertThat(Matrix.parse("{{1, 2, i}}")).isEqualTo(
        Matrix.fromRows([[1, 2, Complex.I]]));
    assertThat(Matrix.parse("{{1}, {2}, {i}}")).isEqualTo(
        Matrix.col(1, 2, Complex.I));
});

suite.test("generate", () => {
    assertThat(Matrix.generate(3, 2, (r, c) => r + 10* c).toString()).
        isEqualTo("{{0, 10, 20}, {1, 11, 21}}");
});

suite.test("generateDiagonal", () => {
    assertThat(Matrix.generateDiagonal(4, e => new Complex(e, 1))).
        isEqualTo(Matrix.square(
            new Complex(0, 1), 0, 0, 0,
            0, new Complex(1, 1), 0, 0,
            0, 0, new Complex(2, 1), 0,
            0, 0, 0, new Complex(3, 1)));
});

suite.test("generateTransition", () => {
    assertThat(Matrix.generateTransition(4, e => (e + 1) & 3)).
        isEqualTo(Matrix.square(
            0, 0, 0, 1,
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0));
});

suite.test("zero", () => {
    assertThat(Matrix.zero(1, 1).toString()).isEqualTo("{{0}}");
    assertThat(Matrix.zero(2, 1).toString()).isEqualTo("{{0, 0}}");
    assertThat(Matrix.zero(1, 2).toString()).isEqualTo("{{0}, {0}}");
    assertThat(Matrix.zero(2, 2).toString()).isEqualTo("{{0, 0}, {0, 0}}");
});

suite.test("getColumn", () => {
    const m = Matrix.square(2, 3, 5, 7);
    assertThat(m.getColumn(0)).isEqualTo([2, 5]);
    assertThat(m.getColumn(1)).isEqualTo([3, 7]);
    assertThat(Matrix.col(1, 2, 3).getColumn(0)).isEqualTo([1, 2, 3]);
});

suite.test("square", () => {
    const m = Matrix.square(1, new Complex(2, 3), -5.5, 0);
    assertThat(m.rows()).isEqualTo([[1, new Complex(2, 3)], [-5.5, 0]]);

    assertThat(Matrix.fromRows([[1]]).rows()).isEqualTo([[1]]);
});

suite.test("col", () => {
    assertThat(Matrix.col(2, 3, new Complex(0, 5)).toString()).isEqualTo("{{2}, {3}, {5i}}");
});

suite.test("size", () => {
    assertThat(Matrix.fromRows([[1, 1]]).width()).isEqualTo(2);
    assertThat(Matrix.fromRows([[1, 1]]).height()).isEqualTo(1);

    assertThat(Matrix.fromRows([[1, 1, 3]]).width()).isEqualTo(3);
    assertThat(Matrix.fromRows([[1, 1, 3]]).height()).isEqualTo(1);

    assertThat(Matrix.col(1, 1).width()).isEqualTo(1);
    assertThat(Matrix.col(1, 1).height()).isEqualTo(2);

    assertThat(Matrix.col(1, 1, 3).width()).isEqualTo(1);
    assertThat(Matrix.col(1, 1, 3).height()).isEqualTo(3);
});

suite.test("isUnitary", () => {
    assertFalse(Matrix.fromRows([[1, 1]]).isUnitary(999));
    assertFalse(Matrix.col(1, 1).isUnitary(999));

    assertTrue(Matrix.fromRows([[1]]).isUnitary(0));
    assertTrue(Matrix.fromRows([[Complex.I]]).isUnitary(0));
    assertTrue(Matrix.fromRows([[-1]]).isUnitary(0));
    assertFalse(Matrix.fromRows([[-2]]).isUnitary(0));
    assertFalse(Matrix.fromRows([[0]]).isUnitary(0));
    assertTrue(Matrix.fromRows([[-2]]).isUnitary(999));

    assertTrue(Matrix.square(1, 0, 0, 1).isUnitary(0));
    assertTrue(Matrix.rotation(1).isUnitary(0.001));
    assertTrue(QubitMatrix.PAULI_X.isUnitary(0));
    assertTrue(QubitMatrix.PAULI_Y.isUnitary(0));
    assertTrue(QubitMatrix.PAULI_Z.isUnitary(0));
    assertTrue(QubitMatrix.HADAMARD.isUnitary(0.001));
});

suite.test("isApproximatelyHermitian", () => {
    const i = Complex.I;

    assertFalse(Matrix.fromRows([[1, 1]]).isApproximatelyHermitian(999));
    assertFalse(Matrix.col(1, 1).isApproximatelyHermitian(999));

    assertTrue(Matrix.fromRows([[1]]).isApproximatelyHermitian(0));
    assertTrue(Matrix.fromRows([[0]]).isApproximatelyHermitian(0));
    assertTrue(Matrix.fromRows([[-1]]).isApproximatelyHermitian(0));
    assertTrue(Matrix.fromRows([[-2]]).isApproximatelyHermitian(0));
    assertFalse(Matrix.fromRows([[i]]).isApproximatelyHermitian(0));
    assertFalse(Matrix.fromRows([[i]]).isApproximatelyHermitian(0.5));
    assertTrue(Matrix.fromRows([[i]]).isApproximatelyHermitian(999));

    assertTrue(QubitMatrix.PAULI_X.isApproximatelyHermitian(0));
    assertTrue(QubitMatrix.PAULI_Y.isApproximatelyHermitian(0));
    assertTrue(QubitMatrix.PAULI_Z.isApproximatelyHermitian(0));
    assertTrue(QubitMatrix.HADAMARD.isApproximatelyHermitian(0.001));

    assertTrue(Matrix.square(1, 0, 0, 1).isApproximatelyHermitian(0));
    assertTrue(Matrix.square(1, 1, 1, 1).isApproximatelyHermitian(0));
    assertFalse(Matrix.square(1, 1, 1.5, 1).isApproximatelyHermitian(0));
    assertTrue(Matrix.square(1, 1, 1.5, 1).isApproximatelyHermitian(0.5));

    assertFalse(Matrix.square(1, i, i, 1).isApproximatelyHermitian(0));
    assertTrue(Matrix.square(1, i, i.neg(), 1).isApproximatelyHermitian(0));
    assertTrue(Matrix.square(1, i.neg(), i, 1).isApproximatelyHermitian(0));
    assertFalse(Matrix.square(1, i, i.times(-1.5), 1).isApproximatelyHermitian(0));
    assertTrue(Matrix.square(1, i, i.times(-1.5), 1).isApproximatelyHermitian(0.5));
});

suite.test("isIdentity", () => {
    const i = Complex.I;

    assertFalse(Matrix.fromRows([[NaN]]).isIdentity());
    assertFalse(Matrix.fromRows([[-1]]).isIdentity());
    assertFalse(Matrix.fromRows([[0]]).isIdentity());
    assertTrue(Matrix.fromRows([[1]]).isIdentity());
    assertFalse(Matrix.fromRows([[i]]).isIdentity());
    assertFalse(Matrix.fromRows([[2]]).isIdentity());

    assertFalse(Matrix.fromRows([[1, 0]]).isIdentity());
    assertFalse(Matrix.fromRows([[1, 1]]).isIdentity());
    assertFalse(Matrix.col(1, 0).isIdentity());
    assertFalse(Matrix.col(1, 1).isIdentity());

    assertFalse(QubitMatrix.PAULI_X.isIdentity());
    assertFalse(QubitMatrix.PAULI_Y.isIdentity());
    assertFalse(QubitMatrix.PAULI_Z.isIdentity());
    assertFalse(QubitMatrix.HADAMARD.isIdentity());

    assertTrue(Matrix.square(1, 0, 0, 1).isIdentity());
    assertFalse(Matrix.square(1, 1, 1, 1).isIdentity());
    assertFalse(Matrix.square(1, 1, 1.5, 1).isIdentity());
    assertFalse(Matrix.square(1, 1, 1.5, 1).isIdentity());
    assertFalse(Matrix.square(1, i, i, 1).isIdentity());
    assertFalse(Matrix.square(1, i, i.neg(), 1).isIdentity());

    assertTrue(Matrix.square(1, 0, 0, 0, 1, 0, 0, 0, 1).isIdentity());
});

suite.test("isScaler", () => {
    const i = Complex.I;

    assertFalse(Matrix.fromRows([[NaN]]).isScaler());
    assertTrue(Matrix.fromRows([[-1]]).isScaler());
    assertTrue(Matrix.fromRows([[0]]).isScaler());
    assertTrue(Matrix.fromRows([[1]]).isScaler());
    assertTrue(Matrix.fromRows([[i]]).isScaler());
    assertTrue(Matrix.fromRows([[2]]).isScaler());

    assertFalse(Matrix.fromRows([[1, 0]]).isScaler());
    assertFalse(Matrix.fromRows([[1, 1]]).isScaler());
    assertFalse(Matrix.col(1, 0).isScaler());
    assertFalse(Matrix.col(1, 1).isScaler());

    assertFalse(QubitMatrix.PAULI_X.isScaler());
    assertFalse(QubitMatrix.PAULI_Y.isScaler());
    assertFalse(QubitMatrix.PAULI_Z.isScaler());
    assertFalse(QubitMatrix.HADAMARD.isScaler());

    assertTrue(Matrix.square(1, 0, 0, 1).isScaler());
    assertTrue(Matrix.square(-1, 0, 0, -1).isScaler());
    assertTrue(Matrix.square(i, 0, 0, i).isScaler());
    assertFalse(Matrix.square(1, 1, 1, 1).isScaler());
    assertFalse(Matrix.square(1, 1, 1.5, 1).isScaler());
    assertFalse(Matrix.square(1, 1, 1.5, 1).isScaler());
    assertFalse(Matrix.square(1, i, i, 1).isScaler());
    assertFalse(Matrix.square(1, i, i.neg(), 1).isScaler());

    assertTrue(Matrix.square(1, 0, 0, 0, 1, 0, 0, 0, 1).isScaler());
    assertTrue(Matrix.square(i, 0, 0, 0, i, 0, 0, 0, i).isScaler());
    assertFalse(Matrix.square(i, 0, 0, 0, 1, 0, 0, 0, i).isScaler());
});

suite.test("isPhasedPermutation", () => {
    const i = Complex.I;

    assertTrue(Matrix.fromRows([[-1]]).isPhasedPermutation());
    assertTrue(Matrix.fromRows([[0]]).isPhasedPermutation());
    assertTrue(Matrix.fromRows([[1]]).isPhasedPermutation());
    assertTrue(Matrix.fromRows([[i]]).isPhasedPermutation());
    assertTrue(Matrix.fromRows([[2]]).isPhasedPermutation());

    assertFalse(Matrix.fromRows([[1, 0]]).isPhasedPermutation());
    assertFalse(Matrix.fromRows([[1, 1]]).isPhasedPermutation());
    assertFalse(Matrix.col(1, 0).isPhasedPermutation());
    assertFalse(Matrix.col(1, 1).isPhasedPermutation());

    assertTrue(QubitMatrix.PAULI_X.isPhasedPermutation());
    assertTrue(QubitMatrix.PAULI_Y.isPhasedPermutation());
    assertTrue(QubitMatrix.PAULI_Z.isPhasedPermutation());
    assertFalse(QubitMatrix.HADAMARD.isPhasedPermutation());

    assertTrue(Matrix.square(1, 0, 0, 1).isPhasedPermutation());
    assertFalse(Matrix.square(1, 1, 1, 1).isPhasedPermutation());
    assertFalse(Matrix.square(1, 1, 1.5, 1).isPhasedPermutation());
    assertFalse(Matrix.square(1, 1, 1.5, 1).isPhasedPermutation());
    assertFalse(Matrix.square(1, i, i, 1).isPhasedPermutation());
    assertFalse(Matrix.square(1, i, i.neg(), 1).isPhasedPermutation());

    assertTrue(Matrix.square(1, 0, 0, 0, 1, 0, 0, 0, 1).isPhasedPermutation());
    assertTrue(Matrix.square(1, 0, 0, 0, 0, i, 0, 1, 0).isPhasedPermutation());

    assertFalse(Matrix.square(1, 0.1, 0, 1).isPhasedPermutation(0));
    assertFalse(Matrix.square(1, 0.1, 0, 1).isPhasedPermutation(0.05));
    assertTrue(Matrix.square(1, 0.1, 0, 1).isPhasedPermutation(0.2));

    assertTrue(Matrix.fromRows([[NaN]]).isPhasedPermutation());
    assertFalse(Matrix.square(NaN, NaN, NaN, NaN).isPhasedPermutation());
    assertTrue(Matrix.square(NaN, 0, 0, NaN).isPhasedPermutation());
});

suite.test("adjoint", () => {
    const v = Matrix.square(new Complex(2, 3), new Complex(5, 7),
                          new Complex(11, 13), new Complex(17, 19));
    const a = Matrix.square(new Complex(2, -3), new Complex(11, -13),
                          new Complex(5, -7), new Complex(17, -19));
    assertThat(v.adjoint()).isEqualTo(a);
    assertThat(Matrix.col(1, 2, Complex.I).adjoint()).isEqualTo(Matrix.fromRows([[1, 2, Complex.I.neg()]]));
});

suite.test("transpose", () => {
    const v = Matrix.square(
        new Complex(2, 3), new Complex(5, 7),
        new Complex(11, 13), new Complex(17, 19));
    const a = Matrix.square(
        new Complex(2, 3), new Complex(11, 13),
        new Complex(5, 7), new Complex(17, 19));
    assertThat(v.transpose()).isEqualTo(a);
    assertThat(Matrix.col(1, 2, Complex.I).transpose()).isEqualTo(Matrix.fromRows([[1, 2, Complex.I]]));
});

suite.test("times_scalar", () => {
    const v = Matrix.square(new Complex(2, 3), new Complex(5, 7),
                          new Complex(11, 13), new Complex(17, 19));
    const a = Matrix.square(new Complex(-2, -3), new Complex(-5, -7),
                          new Complex(-11, -13), new Complex(-17, -19));
    assertThat(v.times(-1)).isEqualTo(a);
    assertThat(v.times(0)).isEqualTo(Matrix.square(0, 0, 0, 0));
    assertThat(v.times(1)).isEqualTo(v);

    assertThat(Matrix.col(2, 3).times(5)).isEqualTo(Matrix.col(10, 15));
    assertThat(Matrix.fromRows([[2, 3]]).times(5)).isEqualTo(Matrix.fromRows([[10, 15]]));
});

suite.test("plus", () => {
    assertThat(Matrix.square(2, 3, 5, 7).plus(Matrix.square(11, 13, 17, 19)))
        .isEqualTo(Matrix.square(13, 16, 22, 26));
});

suite.test("minus", () => {
    assertThat(Matrix.square(2, 3, 5, 7).minus(Matrix.square(11, 13, 17, 19)))
        .isEqualTo(Matrix.square(-9, -10, -12, -12));
});

suite.test("times_matrix", () => {
    assertThat(Matrix.square(2, 3, 5, 7).times(Matrix.square(11, 13, 17, 19)))
        .isEqualTo(Matrix.square(73, 83, 174, 198));

    const x = Matrix.square(new Complex(0.5, -0.5), new Complex(0.5, 0.5),
                          new Complex(0.5, 0.5), new Complex(0.5, -0.5));
    assertThat(x.times(x.adjoint())).isEqualTo(Matrix.identity(2));
    assertThat(QubitMatrix.PAULI_X.times(QubitMatrix.PAULI_Y).times(QubitMatrix.PAULI_Z).times(new Complex(0, -1)))
        .isEqualTo(Matrix.identity(2));
});

suite.test("times_ColRow", () => {
    // When one is a column vector and the other is a row vector...
    const r = Matrix.fromRows([[2, 3, 5]]);
    const c = Matrix.col(11, 13, 17);

    // Inner product
    assertThat(r.times(c).toString()).isEqualTo("{{146}}");

    // Outer product
    assertThat(c.times(r).toString()).isEqualTo("{{22, 33, 55}, {26, 39, 65}, {34, 51, 85}}");

    // Outer product matches tensor product
    assertThat(c.times(r)).isEqualTo(tensorProduct(c, r));

    // Tensor product is order independent (in this case)
    assertThat(tensorProduct(r, c)).isEqualTo(tensorProduct(c, r));
});

suite.test("norm2", () => {
    assertThat(Matrix.fromRows([[1]]).norm2()).isEqualTo(1);
    assertThat(Matrix.fromRows([[2]]).norm2()).isEqualTo(4);
    assertThat(Matrix.fromRows([[1, 1]]).norm2()).isEqualTo(2);
    assertThat(Matrix.col(1, 1).norm2()).isEqualTo(2);
    assertThat(Matrix.square(1, 2, 3, 4).norm2()).isEqualTo(30);
});

suite.test("identity", () => {
    assertThat(Matrix.identity(1).toString()).
        isEqualTo("{{1}}");
    assertThat(Matrix.identity(2).toString()).
        isEqualTo("{{1, 0}, {0, 1}}");
    assertThat(Matrix.identity(3).toString()).
        isEqualTo("{{1, 0, 0}, {0, 1, 0}, {0, 0, 1}}");
    assertThat(Matrix.identity(4).toString()).
        isEqualTo("{{1, 0, 0, 0}, {0, 1, 0, 0}, {0, 0, 1, 0}, {0, 0, 0, 1}}");
});

suite.test("rotation", () => {
    const s = Math.sqrt(0.5);
    const t = Math.PI * 2;
    assertThat(Matrix.rotation(0)).isApproximatelyEqualTo(Matrix.square(1, 0, 0, 1));
    assertThat(Matrix.rotation(t / 8)).isApproximatelyEqualTo(Matrix.square(s, -s, s, s));
    assertThat(Matrix.rotation(t * 2 / 8)).isApproximatelyEqualTo(Matrix.square(0, -1, 1, 0));
    assertThat(Matrix.rotation(t * 3 / 8)).isApproximatelyEqualTo(Matrix.square(-s, -s, s, -s));
    assertThat(Matrix.rotation(t * 4 / 8)).isApproximatelyEqualTo(Matrix.square(-1, 0, 0, -1));
    assertThat(Matrix.rotation(t * 5 / 8)).isApproximatelyEqualTo(Matrix.square(-s, s, -s, -s));
    assertThat(Matrix.rotation(t * 6 / 8)).isApproximatelyEqualTo(Matrix.square(0, 1, -1, 0));
    assertThat(Matrix.rotation(t * 7 / 8)).isApproximatelyEqualTo(Matrix.square(s, s, -s, s));
    assertThat(Matrix.rotation(t)).isApproximatelyEqualTo(Matrix.square(1, 0, 0, 1));
});

suite.test("trace", () => {
    assertThat(Matrix.fromRows([[NaN]]).trace().abs()).isEqualTo(NaN);
    assertThat(Matrix.identity(2).trace()).isEqualTo(2);
    assertThat(Matrix.identity(10).trace()).isEqualTo(10);

    assertThat(QubitMatrix.PAULI_X.trace()).isEqualTo(0);
    assertThat(QubitMatrix.PAULI_Y.trace()).isEqualTo(0);
    assertThat(QubitMatrix.PAULI_Z.trace()).isEqualTo(0);
    assertThat(QubitMatrix.HADAMARD.trace()).isApproximatelyEqualTo(0);
    assertThat(Matrix.square(1, 2, 3, 4).trace()).isEqualTo(5);

    assertThat(Matrix.square(0,1,2,3,4,5,6,7,8).trace()).isEqualTo(12);
});

suite.test("cross3", () => {
    const [x, y, z] = [Matrix.col(1, 0, 0), Matrix.col(0, 1, 0), Matrix.col(0, 0, 1)];
    const zero = Matrix.col(0, 0, 0);

    assertThat(zero.cross3(zero)).isEqualTo(zero);
    assertThat(x.cross3(zero)).isEqualTo(zero);
    assertThat(y.cross3(zero)).isEqualTo(zero);
    assertThat(z.cross3(zero)).isEqualTo(zero);

    assertThat(x.cross3(y)).isEqualTo(z);
    assertThat(y.cross3(z)).isEqualTo(x);
    assertThat(z.cross3(x)).isEqualTo(y);

    assertThat(y.cross3(x)).isEqualTo(z.times(-1));
    assertThat(z.cross3(y)).isEqualTo(x.times(-1));
    assertThat(x.cross3(z)).isEqualTo(y.times(-1));

    assertThat(x.times(2).cross3(y.times(3))).isEqualTo(z.times(6));
    assertThat(x.plus(y).cross3(y)).isEqualTo(z);
});

suite.test("isDiagonal", () => {
    assertTrue(Matrix.fromRows([[NaN]]).isDiagonal());
    assertTrue(Matrix.fromRows([[0]]).isDiagonal());
    assertTrue(Matrix.fromRows([[1]]).isDiagonal());
    assertFalse(Matrix.col(0, 0).isDiagonal());
    assertFalse(Matrix.fromRows([[0, 0]]).isDiagonal());

    assertTrue(Matrix.square(1, 0, 0, 0).isDiagonal());
    assertFalse(Matrix.square(0, 1, 0, 0).isDiagonal());
    assertFalse(Matrix.square(0, NaN, 0, 0).isDiagonal());
    assertFalse(Matrix.square(0, 0, 1, 0).isDiagonal());
    assertTrue(Matrix.square(0, 0, 0, 1).isDiagonal());

    assertTrue(Matrix.square(new Complex(2, 3), 0, 0, 0).isDiagonal());
    assertFalse(Matrix.square(0, new Complex(2, 3), 0, 0).isDiagonal());
    assertFalse(Matrix.square(0, 0, new Complex(2, 3), 0).isDiagonal());
    assertTrue(Matrix.square(0, 0, 0, new Complex(2, 3)).isDiagonal());

    assertTrue(Matrix.square(
        -10, 0, 0,
        0, Infinity, 0,
        0, 0, Complex.I).isDiagonal());
    assertFalse(Matrix.square(
        -10, 0.1, 0,
        0, Infinity, 0,
        0, 0, Complex.I).isDiagonal());
    assertTrue(Matrix.square(
        -10, 0.1, 0,
        0, Infinity, 0,
        0, 0, Complex.I).isDiagonal(0.2));
});

suite.test("hasNaN", () => {
    assertTrue(Matrix.fromRows([[NaN]]).hasNaN());
    assertFalse(Matrix.fromRows([[0]]).hasNaN());

    assertTrue(Matrix.fromRows([[new Complex(0, NaN)]]).hasNaN());
    assertTrue(Matrix.square(0, 0, NaN, 0).hasNaN());
    assertFalse(Matrix.square(0, 0, 0, 0).hasNaN());
});

