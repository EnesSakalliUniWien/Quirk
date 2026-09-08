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

import {Suite, assertThat} from "../../TestUtil.js"
import {Gates} from "../../../src/gates/AllGates.js"
import {Complex} from "../../../src/engine/math/complex/Complex.js"
import {liftApply} from "../../MatrixTestUtil.js"
import {QubitMatrix} from "../../../src/engine/math/matrix/QubitMatrix.js"

const suite = new Suite("ExponentiatingGates");

suite.test("timeBased_matchUnoptimized", () => {
    const matches = (gate, func) => {
        for (let t = 0; t < 1; t += 0.05) {
            assertThat(gate.knownMatrixAt(t)).isApproximatelyEqualTo(func(t), 0.0000001);
        }
    };

    const i = Complex.I;
    const τ = Math.PI * 2;
    matches(
        Gates.Exponentiating.XForward,
        t => liftApply(QubitMatrix.PAULI_X, c => c.times(τ * -t).times(i).exp()));
    matches(
        Gates.Exponentiating.XBackward,
        t => liftApply(QubitMatrix.PAULI_X, c => c.times(τ * t).times(i).exp()));
    matches(
        Gates.Exponentiating.YForward,
        t => liftApply(QubitMatrix.PAULI_Y, c => c.times(τ * -t).times(i).exp()));
    matches(
        Gates.Exponentiating.YBackward,
        t => liftApply(QubitMatrix.PAULI_Y, c => c.times(τ * t).times(i).exp()));
    matches(
        Gates.Exponentiating.ZForward,
        t => liftApply(QubitMatrix.PAULI_Z, c => c.times(τ * -t).times(i).exp()));
    matches(
        Gates.Exponentiating.ZBackward,
        t => liftApply(QubitMatrix.PAULI_Z, c => c.times(τ * t).times(i).exp()));

    matches(
        Gates.Powering.XForward,
        t => liftApply(QubitMatrix.PAULI_X, c => c.raisedTo(t * 2)));
    matches(
        Gates.Powering.XBackward,
        t => liftApply(QubitMatrix.PAULI_X, c => c.raisedTo(-t * 2)));
    matches(
        Gates.Powering.YForward,
        t => liftApply(QubitMatrix.PAULI_Y, c => c.raisedTo(t * 2)));
    matches(
        Gates.Powering.YBackward,
        t => liftApply(QubitMatrix.PAULI_Y, c => c.raisedTo(-t * 2)));
    matches(
        Gates.Powering.ZForward,
        t => liftApply(QubitMatrix.PAULI_Z, c => c.raisedTo(t * 2)));
    matches(
        Gates.Powering.ZBackward,
        t => liftApply(QubitMatrix.PAULI_Z, c => c.raisedTo(-t * 2)));
});
