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

import {assertThat, Suite} from "../../TestUtil.js"

import {Complex} from "../../../src/math/Complex.js"
import {Gates} from "../../../src/gates/AllGates.js"
import {Matrix} from "../../../src/math/Matrix.js"
import {Serializer} from "../../../src/circuit/Serializer.js"
import {Gate} from "../../../src/circuit/Gate.js"

let suite = new Suite("RotationGates");

suite.test("rx_matrix_matches_angle", () => {
    let rx = angle => Gates.RotationGates.Rx.withParam(angle).knownMatrixAt(0.1);

    assertThat(rx('0')).isApproximatelyEqualTo(Matrix.identity(2));
    assertThat(rx('pi')).isApproximatelyEqualTo(
        Matrix.square(0, Complex.I.neg(), Complex.I.neg(), 0));
    assertThat(rx('pi/2')).isApproximatelyEqualTo(
        Matrix.square(1, Complex.I.neg(), Complex.I.neg(), 1).times(Math.sqrt(0.5)));
    assertThat(rx(Math.PI / 2)).isApproximatelyEqualTo(
        Matrix.square(1, Complex.I.neg(), Complex.I.neg(), 1).times(Math.sqrt(0.5)));
});

suite.test("ry_matrix_matches_angle", () => {
    let ry = angle => Gates.RotationGates.Ry.withParam(angle).knownMatrixAt(0.1);

    assertThat(ry('0')).isApproximatelyEqualTo(Matrix.identity(2));
    assertThat(ry('pi')).isApproximatelyEqualTo(Matrix.square(0, -1, 1, 0));
    assertThat(ry('pi/2')).isApproximatelyEqualTo(
        Matrix.square(1, -1, 1, 1).times(Math.sqrt(0.5)));
});

suite.test("rz_matrix_matches_angle", () => {
    let rz = angle => Gates.RotationGates.Rz.withParam(angle).knownMatrixAt(0.1);

    assertThat(rz('0')).isApproximatelyEqualTo(Matrix.identity(2));
    assertThat(rz('pi')).isApproximatelyEqualTo(
        Matrix.square(Complex.I.neg(), 0, 0, Complex.I));
    assertThat(rz('pi/2')).isApproximatelyEqualTo(Matrix.square(
        Complex.polar(1, -Math.PI / 4), 0,
        0, Complex.polar(1, Math.PI / 4)));
});

suite.test("angle_change_is_stable_and_negatable", () => {
    let rx = Gates.RotationGates.Rx.withParam('pi/4');
    assertThat(rx.stableDuration()).isEqualTo(Infinity);
    assertThat(rx.alternate.param).isEqualTo('-(pi/4)');
    assertThat(rx.alternate.alternate.param).isEqualTo('pi/4');
    assertThat(rx.alternate.knownMatrixAt(0.1)).isApproximatelyEqualTo(
        rx.knownMatrixAt(0.1).adjoint());
});

suite.test("serializes_angle_roundtrip", () => {
    for (let gate of Gates.RotationGates.all) {
        let adjusted = gate.withParam('3pi/4');
        let restored = Serializer.fromJson(Gate, Serializer.toJson(adjusted));
        assertThat(restored.serializedId).isEqualTo(gate.serializedId);
        assertThat(restored.param).isEqualTo('3pi/4');
        assertThat(restored.knownMatrixAt(0.1)).isApproximatelyEqualTo(adjusted.knownMatrixAt(0.1));
    }
});
