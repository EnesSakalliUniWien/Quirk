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

import {Suite, assertThat, assertThrows} from "../../../TestUtil.js"
import {Complex} from "../../../../src/engine/math/complex/Complex.js"
import {Matrix} from "../../../../src/engine/math/matrix/Matrix.js"
import {Format} from "../../../../src/base/Format.js"
import {MatrixDecomposition} from "../../../../src/engine/math/matrix/MatrixDecomposition.js"
import {isUpperTriangular, isLowerTriangular} from "../../../MatrixTestUtil.js"

let suite = new Suite("MatrixDecomposition");

const assertQrDecompositionWorksFor = m => {
    let {Q, R} = MatrixDecomposition.qr(m);
    assertThat(Q.isUnitary(0.00001)).withInfo({m, Q, R, test: "isUnitary"}).isEqualTo(true);
    assertThat(isUpperTriangular(R, 0.00001)).withInfo({m, Q, R, test: "isUpperTriangular"}).isEqualTo(true);
    assertThat(Q.times(R)).withInfo({m, Q, R}).isApproximatelyEqualTo(m);
};

const assertLqDecompositionWorksFor = m => {
    let {L, Q} = MatrixDecomposition.lq(m);
    assertThat(Q.isUnitary(0.00001)).withInfo({m, L, Q, test: "isUnitary"}).isEqualTo(true);
    assertThat(isLowerTriangular(L, 0.00001)).withInfo({m, L, Q, test: "isLowerTriangular"}).isEqualTo(true);
    assertThat(L.times(Q)).withInfo({m, L, Q}).isApproximatelyEqualTo(m);
};

const assertSvdDecompositionWorksFor = m => {
    let {U, S, V} = MatrixDecomposition.svd(m, 0.000001, 100);
    assertThat(U.isUnitary(0.00001)).withInfo({m, U, S, V, test: "U isUnitary"}).isEqualTo(true);
    assertThat(V.isUnitary(0.00001)).withInfo({m, U, S, V, test: "V isUnitary"}).isEqualTo(true);
    assertThat(S.isDiagonal(0.00001)).withInfo({m, U, S, V, test: "S diagonal"}).isEqualTo(true);
    assertThat(Array.from({length: S.width()}, (_, i) => i).
        every(i => Math.abs(S.cell(i, i).phase()) < 0.000001)).
        withInfo({m, U, S, V, test: "S is positive"}).isEqualTo(true);
    assertThat(U.times(S).times(V)).withInfo({m, U, S, V}).isApproximatelyEqualTo(m, 0.001);
};

suite.test("qrDecomposition", () => {
    assertThrows(() => MatrixDecomposition.qr(Matrix.col(2, 3)));
    assertThrows(() => MatrixDecomposition.qr(Matrix.fromRows([[2, 3]])));

    assertThat(MatrixDecomposition.qr(Matrix.fromRows([[0]]))).isEqualTo({Q: Matrix.fromRows([[1]]), R: Matrix.fromRows([[0]])});
    assertThat(MatrixDecomposition.qr(Matrix.fromRows([[1]]))).isEqualTo({Q: Matrix.fromRows([[1]]), R: Matrix.fromRows([[1]])});

    assertThat(MatrixDecomposition.qr(Matrix.square(2, 3, 0, 5))).isEqualTo({
        Q: Matrix.square(1, 0, 0, 1),
        R: Matrix.square(2, 3, 0, 5)
    });
    assertThat(MatrixDecomposition.qr(Matrix.square(2, 0, 3, 5))).isApproximatelyEqualTo({
        Q: Matrix.square(0.5547, -0.83205, 0.83205, 0.5547),
        R: Matrix.square(3.60555, 4.16025, 0, 2.7735)
    }, 0.0001);
    assertQrDecompositionWorksFor(Matrix.square(0, 0, 1, 0));
    assertQrDecompositionWorksFor(Matrix.square(0, 1, 0, 0));
    assertQrDecompositionWorksFor(Matrix.square(2, 0, 3, 5));
    assertQrDecompositionWorksFor(Matrix.square(-1, Complex.I, Complex.I, 1));
    assertQrDecompositionWorksFor(Matrix.square(2, 3, 5, 7, new Complex(11, 13), 17, 19, 23, 29));
});

suite.test("qrDecomposition_randomized", () => {
    for (let k = 1; k < 6; k++) {
        let m = Matrix.generate(k, k, () => new Complex(Math.random() - 0.5, Math.random() - 0.5));
        assertQrDecompositionWorksFor(m);
    }
});

suite.test("lqDecomposition", () => {
    assertThrows(() => MatrixDecomposition.lq(Matrix.col(2, 3)));
    assertThrows(() => MatrixDecomposition.lq(Matrix.fromRows([[2, 3]])));

    assertThat(MatrixDecomposition.lq(Matrix.fromRows([[0]]))).isEqualTo({L: Matrix.fromRows([[0]]), Q: Matrix.fromRows([[1]])});
    assertThat(MatrixDecomposition.lq(Matrix.fromRows([[1]]))).isEqualTo({L: Matrix.fromRows([[1]]), Q: Matrix.fromRows([[1]])});

    assertThat(MatrixDecomposition.lq(Matrix.square(2, 3, 0, 5))).isApproximatelyEqualTo({
        L: Matrix.square(3.60555, 0, 4.16025, 2.7735),
        Q: Matrix.square(0.5547, 0.83205, -0.83205, 0.5547)
    }, 0.0001);
    assertThat(MatrixDecomposition.lq(Matrix.square(2, 0, 3, 5))).isEqualTo({
        L: Matrix.square(2, 0, 3, 5),
        Q: Matrix.square(1, 0, 0, 1)
    });
    assertLqDecompositionWorksFor(Matrix.square(0, 0, 1, 0));
    assertLqDecompositionWorksFor(Matrix.square(0, 1, 0, 0));
    assertLqDecompositionWorksFor(Matrix.square(2, 0, 3, 5));
    assertLqDecompositionWorksFor(Matrix.square(-1, Complex.I, Complex.I, 1));
    assertLqDecompositionWorksFor(Matrix.square(2, 3, 5, 7, new Complex(11, 13), 17, 19, 23, 29));
});

suite.test("lqDecomposition_randomized", () => {
    for (let k = 1; k < 6; k++) {
        let m = Matrix.generate(k, k, () => new Complex(Math.random() - 0.5, Math.random() - 0.5));
        assertLqDecompositionWorksFor(m);
    }
});

suite.test("singularValueDecomposition", () => {
    assertThat(MatrixDecomposition.svd(Matrix.zero(2, 2))).isEqualTo({
        U: Matrix.identity(2),
        S: Matrix.zero(2, 2),
        V: Matrix.identity(2)
    });

    assertThat(MatrixDecomposition.svd(Matrix.identity(2))).isEqualTo({
        U: Matrix.identity(2),
        S: Matrix.identity(2),
        V: Matrix.identity(2)
    });

    assertSvdDecompositionWorksFor(Matrix.square(1, Complex.I.times(2), 3, 4));
    assertSvdDecompositionWorksFor(Matrix.square(
        new Complex(2, 3), new Complex(5, 7),
        new Complex(11, 13), new Complex(17, 19)));
    assertSvdDecompositionWorksFor(Matrix.square(
        new Complex(2, 3), new Complex(5, 7), new Complex(11, 13),
        new Complex(17, 19), new Complex(23, 29), new Complex(31, 37),
        new Complex(41, 43), new Complex(47, 53), new Complex(59, 61)));
    assertSvdDecompositionWorksFor(Matrix.square(
        new Complex(2, 3), new Complex(5, 7), new Complex(11, 13),
        new Complex(17, 19), new Complex(-23, 29), new Complex(31, 37),
        new Complex(41, -43), new Complex(47, -53), new Complex(59, 61)));

    assertSvdDecompositionWorksFor(Matrix.generateDiagonal(4, k => Complex.polar(1, Math.PI*2/3*k)));
});

suite.test("singularValueDecomposition_randomized", () => {
    for (let k = 1; k < 5; k++) {
        let m = Matrix.generate(k, k, () => new Complex(Math.random() - 0.5, Math.random() - 0.5));
        assertSvdDecompositionWorksFor(m);
    }
});

suite.test("closestUnitary", () => {
    let i = Complex.I;
    let ni = i.neg();
    assertThat(MatrixDecomposition.closestUnitary(Matrix.square(0, 0, 0, 0))).
        isApproximatelyEqualTo(Matrix.square(1, 0, 0, 1));
    assertThat(MatrixDecomposition.closestUnitary(Matrix.square(2, 0, 0, 0.0001))).
        isApproximatelyEqualTo(Matrix.square(1, 0, 0, 1));
    assertThat(MatrixDecomposition.closestUnitary(Matrix.square(0, 0.5, 0.0001, 0))).
        isApproximatelyEqualTo(Matrix.square(0, 1, 1, 0));
    assertThat(MatrixDecomposition.closestUnitary(Matrix.square(1.01, i, -1, ni))).
        isApproximatelyEqualTo(Matrix.square(1, 0, 0, ni));

    let m = Matrix.square(
        1,  1,  1,  1,
        1,  i, -1, ni,
        1, -1,  1, -1,
        1, ni, -1,  i);
    assertThat(MatrixDecomposition.closestUnitary(m, 0.001)).isApproximatelyEqualTo(m.times(0.5));

    let m2 = Matrix.generateDiagonal(4, k => Complex.polar(1, Math.PI*2/3*k));
    assertThat(MatrixDecomposition.closestUnitary(m2, 0.001)).isApproximatelyEqualTo(m2);
});