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
import {Seq} from "../../../../src/base/Seq.js"
import {QubitMatrix} from "../../../../src/engine/math/matrix/QubitMatrix.js"
import {fromAngleAxisPhaseRotation} from "../../../MatrixTestUtil.js"

let suite = new Suite("QubitMatrix");

suite.test("fromPauliRotation", () => {
    // No turn gives no-op
    assertThat(QubitMatrix.fromPauliRotation(0, 0, 0)).isApproximatelyEqualTo(Matrix.identity(2));

    // Whole turns are no-ops
    assertThat(QubitMatrix.fromPauliRotation(1, 0, 0)).isApproximatelyEqualTo(Matrix.identity(2));
    assertThat(QubitMatrix.fromPauliRotation(0, 1, 0)).isApproximatelyEqualTo(Matrix.identity(2));
    assertThat(QubitMatrix.fromPauliRotation(0, 0, 1)).isApproximatelyEqualTo(Matrix.identity(2));
    assertThat(QubitMatrix.fromPauliRotation(-1, 0, 0)).isApproximatelyEqualTo(Matrix.identity(2));
    assertThat(QubitMatrix.fromPauliRotation(0, -1, 0)).isApproximatelyEqualTo(Matrix.identity(2));
    assertThat(QubitMatrix.fromPauliRotation(0, 0, -1)).isApproximatelyEqualTo(Matrix.identity(2));
    assertThat(QubitMatrix.fromPauliRotation(0.6, 0.8, 0)).isApproximatelyEqualTo(Matrix.identity(2));

    // Half turns along each axis is the corresponding Pauli operation
    assertThat(QubitMatrix.fromPauliRotation(0.5, 0, 0)).isApproximatelyEqualTo(QubitMatrix.PAULI_X);
    assertThat(QubitMatrix.fromPauliRotation(0, 0.5, 0)).isApproximatelyEqualTo(QubitMatrix.PAULI_Y);
    assertThat(QubitMatrix.fromPauliRotation(0, 0, 0.5)).isApproximatelyEqualTo(QubitMatrix.PAULI_Z);
    assertThat(QubitMatrix.fromPauliRotation(-0.5, 0, 0)).isApproximatelyEqualTo(QubitMatrix.PAULI_X);
    assertThat(QubitMatrix.fromPauliRotation(0, -0.5, 0)).isApproximatelyEqualTo(QubitMatrix.PAULI_Y);
    assertThat(QubitMatrix.fromPauliRotation(0, 0, -0.5)).isApproximatelyEqualTo(QubitMatrix.PAULI_Z);

    // Hadamard
    assertThat(QubitMatrix.fromPauliRotation(Math.sqrt(0.125), 0, Math.sqrt(0.125))).
        isApproximatelyEqualTo(QubitMatrix.HADAMARD);

    // Opposites are inverses
    assertThat(QubitMatrix.fromPauliRotation(-0.25, 0, 0).times(QubitMatrix.fromPauliRotation(0.25, 0, 0))).
        isApproximatelyEqualTo(Matrix.identity(2));
    assertThat(QubitMatrix.fromPauliRotation(0, -0.25, 0).times(QubitMatrix.fromPauliRotation(0, 0.25, 0))).
        isApproximatelyEqualTo(Matrix.identity(2));
    assertThat(QubitMatrix.fromPauliRotation(0, 0, -0.25).times(QubitMatrix.fromPauliRotation(0, 0, 0.25))).
        isApproximatelyEqualTo(Matrix.identity(2));

    // Doubling rotation is like squaring
    let s1 = QubitMatrix.fromPauliRotation(0.1, 0.15, 0.25);
    let s2 = QubitMatrix.fromPauliRotation(0.2, 0.3, 0.5);
    assertThat(s1.times(s1)).isApproximatelyEqualTo(s2);
});

suite.test("qubitDensityMatrixToBlochVector", () => {
    assertThrows(() => QubitMatrix.densityMatrixToBlochVector(Matrix.fromRows([[1]])));
    assertThrows(() => QubitMatrix.densityMatrixToBlochVector(Matrix.square(1,0,0,0,0,0,0,0,0)));
    assertThrows(() => QubitMatrix.densityMatrixToBlochVector(Matrix.identity(2)));
    assertThrows(() => QubitMatrix.densityMatrixToBlochVector(Matrix.square(1, 1, -1, 0)));
    assertThrows(() => QubitMatrix.densityMatrixToBlochVector(Matrix.square(1, 1, 0, 0)));
    assertThrows(() => QubitMatrix.densityMatrixToBlochVector(Matrix.square(1, Complex.I, Complex.I, 0)));

    // Maximally mixed state.
    assertThat(QubitMatrix.densityMatrixToBlochVector(Matrix.identity(2).times(0.5))).
        isEqualTo([0, 0, 0]);

    // Pure states as vectors along each axis.
    let f = (...m) => Matrix.col(...m).times(Matrix.col(...m).adjoint());
    let i = Complex.I;
    let mi = i.times(-1);
    assertThat(QubitMatrix.densityMatrixToBlochVector(f(1, 0))).isEqualTo([0, 0, -1]);
    assertThat(QubitMatrix.densityMatrixToBlochVector(f(0, 1))).isEqualTo([0, 0, 1]);
    assertThat(QubitMatrix.densityMatrixToBlochVector(f(1, 1).times(0.5))).isEqualTo([-1, 0, 0]);
    assertThat(QubitMatrix.densityMatrixToBlochVector(f(1, -1).times(0.5))).isEqualTo([1, 0, 0]);
    assertThat(QubitMatrix.densityMatrixToBlochVector(f(1, i).times(0.5))).isEqualTo([0, -1, 0]);
    assertThat(QubitMatrix.densityMatrixToBlochVector(f(1, mi).times(0.5))).isEqualTo([0, 1, 0]);
});

suite.test("qubitOperationToAngleAxisRotation", () => {
    assertThrows(() => QubitMatrix.operationToAngleAxisRotation(Matrix.fromRows([[1]])));
    assertThrows(() => QubitMatrix.operationToAngleAxisRotation(Matrix.square(1, 2, 3, 4)));

    let [w, x, y, z] = [Matrix.identity(2), QubitMatrix.PAULI_X, QubitMatrix.PAULI_Y, QubitMatrix.PAULI_Z];
    let π = Math.PI;
    let i = Complex.I;
    let mi = i.neg();
    let s = Math.sqrt(0.5);

    assertThat(QubitMatrix.operationToAngleAxisRotation(w)).isEqualTo({angle: 0, axis: [1, 0, 0], phase: 0});
    assertThat(QubitMatrix.operationToAngleAxisRotation(x)).isEqualTo({angle: π, axis: [1, 0, 0], phase: π/2});
    assertThat(QubitMatrix.operationToAngleAxisRotation(y)).isEqualTo({angle: π, axis: [0, 1, 0], phase: π/2});
    assertThat(QubitMatrix.operationToAngleAxisRotation(z)).isEqualTo({angle: π, axis: [0, 0, 1], phase: π/2});

    assertThat(QubitMatrix.operationToAngleAxisRotation(w.times(i))).isEqualTo({angle: 0, axis: [1, 0, 0], phase: π/2});
    assertThat(QubitMatrix.operationToAngleAxisRotation(x.times(i))).isEqualTo({angle: π, axis: [1, 0, 0], phase: π});
    assertThat(QubitMatrix.operationToAngleAxisRotation(y.times(i))).isEqualTo({angle: π, axis: [0, 1, 0], phase: π});
    assertThat(QubitMatrix.operationToAngleAxisRotation(z.times(i))).isEqualTo({angle: π, axis: [0, 0, 1], phase: π});

    assertThat(QubitMatrix.operationToAngleAxisRotation(w.times(mi))).isEqualTo({angle: 0, axis: [1, 0, 0], phase: -π/2});
    assertThat(QubitMatrix.operationToAngleAxisRotation(x.times(mi))).isEqualTo({angle: π, axis: [1, 0, 0], phase: 0});
    assertThat(QubitMatrix.operationToAngleAxisRotation(y.times(mi))).isEqualTo({angle: π, axis: [0, 1, 0], phase: 0});
    assertThat(QubitMatrix.operationToAngleAxisRotation(z.times(mi))).isEqualTo({angle: π, axis: [0, 0, 1], phase: 0});

    assertThat(QubitMatrix.operationToAngleAxisRotation(QubitMatrix.HADAMARD)).
        isEqualTo({angle: π, axis: [s, 0, s], phase: π/2});
    assertThat(QubitMatrix.operationToAngleAxisRotation(Matrix.square(1, i, i, 1).times(s))).
        isEqualTo({angle: -π/2, axis: [1, 0, 0], phase: 0});
    assertThat(QubitMatrix.operationToAngleAxisRotation(Matrix.square(s, s, -s, s))).
        isEqualTo({angle: -π/2, axis: [0, 1, 0], phase: 0});
    assertThat(QubitMatrix.operationToAngleAxisRotation(Matrix.square(1, 0, 0, i))).
        isEqualTo({angle: π/2, axis: [0, 0, 1], phase: π/4});
});

suite.test("qubitOperationToAngleAxisRotation_vs_fromAngleAxisPhaseRotation_randomized", () => {
    //noinspection JSUnusedLocalSymbols
    for (let _ of Seq.range(100)) {
        let phase = Math.random() * Math.PI * 2;
        let angle = Math.random() * Math.PI * 4;
        let a = Math.random() * Math.PI * 2;
        let b = Math.acos(Math.random() * 2 - 1);
        let axis = [
            Math.cos(a)*Math.sin(b),
            Math.sin(a)*Math.sin(b),
            Math.cos(b)
        ];
        let U = fromAngleAxisPhaseRotation(angle, axis, phase);
        let {angle: angle2, axis: axis2, phase: phase2} = QubitMatrix.operationToAngleAxisRotation(U);
        let U2 = fromAngleAxisPhaseRotation(angle2, axis2, phase2);
        assertThat(U2).withInfo({angle, axis, phase}).isApproximatelyEqualTo(U);
    }
});