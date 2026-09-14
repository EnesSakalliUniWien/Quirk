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

import {Suite, assertThat, assertTrue} from "../../TestUtil.js"
import {blochCoordinates, blochAngles, pureStateText, blochQuaternion, pureQuaternionText, quaternionText, componentFormulas} from "../../../src/engine/math/bloch.js"
import {projectPoint} from "../../../src/draw/displays/BlochScene.js"
import {Matrix} from "../../../src/engine/math/matrix/Matrix.js"
import {Complex} from "../../../src/engine/math/complex/Complex.js"

const suite = new Suite("blochSphereDialog");

suite.test("maps the basis states to the conventional poles", () => {
    const ground = blochCoordinates(Matrix.square(1, 0, 0, 0));
    assertThat(ground.x).isApproximatelyEqualTo(0);
    assertThat(ground.y).isApproximatelyEqualTo(0);
    assertThat(ground.z).isApproximatelyEqualTo(1);

    const excited = blochCoordinates(Matrix.square(0, 0, 0, 1));
    assertThat(excited.z).isApproximatelyEqualTo(-1);

    const plus = blochCoordinates(Matrix.square(0.5, 0.5, 0.5, 0.5));
    assertThat(plus.x).isApproximatelyEqualTo(1);
    assertThat(plus.y).isApproximatelyEqualTo(0);
    assertThat(plus.z).isApproximatelyEqualTo(0);
});

suite.test("reads the angles off the vector", () => {
    const ground = blochAngles({x: 0, y: 0, z: 1});
    assertThat(ground.r).isApproximatelyEqualTo(1);
    assertThat(ground.theta).isApproximatelyEqualTo(0);

    const plus = blochAngles({x: 1, y: 0, z: 0});
    assertThat(plus.theta).isApproximatelyEqualTo(Math.PI / 2);
    assertThat(plus.phi).isApproximatelyEqualTo(0);

    const mixed = blochAngles({x: 0, y: 0, z: 0});
    assertThat(mixed.r).isApproximatelyEqualTo(0);
    assertThat(mixed.theta).isApproximatelyEqualTo(0);
});

suite.test("prints the pure state's amplitudes", () => {
    assertThat(pureStateText(0, 0)).isEqualTo("1.000 |0⟩ + (+0.000+0.000i) |1⟩");
    assertTrue(pureStateText(Math.PI / 2, 0).startsWith("0.707 |0⟩ + (+0.707"));
    assertTrue(pureStateText(Math.PI / 2, Math.PI / 2).includes("+0.000+0.707i"));
});

suite.test("projects along the untilted view's axes", () => {
    // At yaw 0 and pitch 0: y is screen-right, z is screen-up, x points at the viewer.
    const px = projectPoint(1, 0, 0, 0, 0);
    assertThat(px.sx).isApproximatelyEqualTo(0);
    assertThat(px.sy).isApproximatelyEqualTo(0);
    assertThat(px.depth).isApproximatelyEqualTo(1);

    const py = projectPoint(0, 1, 0, 0, 0);
    assertThat(py.sx).isApproximatelyEqualTo(1);
    assertThat(py.depth).isApproximatelyEqualTo(0);

    const pz = projectPoint(0, 0, 1, 0, 0);
    assertThat(pz.sy).isApproximatelyEqualTo(1);
    assertThat(pz.depth).isApproximatelyEqualTo(0);
});

/** q v q̄ for a unit quaternion q and a pure quaternion v, by two Hamilton products. */
function rotate(q, v) {
    const mul = (a, b) => ({
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
        x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    });
    const r = mul(mul(q, {w: 0, ...v}), {w: q.w, x: -q.x, y: -q.y, z: -q.z});
    return {x: r.x, y: r.y, z: r.z};
}

suite.test("the state's quaternion turns the |0⟩ pole k onto the Bloch vector", () => {
    for (const [theta, phi] of [[0, 0], [Math.PI / 2, 0], [Math.PI / 2, Math.PI / 2], [Math.PI, 0], [1.1, -2.3], [2.7, 0.4]]) {
        const q = blochQuaternion(theta, phi);
        assertThat(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z).isApproximatelyEqualTo(1);
        assertThat(rotate(q, {x: 0, y: 0, z: 1})).isApproximatelyEqualTo({
            x: Math.sin(theta) * Math.cos(phi), y: Math.sin(theta) * Math.sin(phi), z: Math.cos(theta)});
    }
});

suite.test("the state's quaternion holds its amplitudes: α = w and β = y - x i", () => {
    const q = blochQuaternion(1.1, -2.3);
    const [α, β] = [new Complex(q.w, 0), new Complex(q.y, -q.x)];
    // In the simulator's convention: conj(α) β above the diagonal, as qubitMarginals notes.
    const ρ = Matrix.square(α.conjugate().times(α), α.conjugate().times(β),
        β.conjugate().times(α), β.conjugate().times(β));
    assertThat(blochCoordinates(ρ)).isApproximatelyEqualTo(rotate(q, {x: 0, y: 0, z: 1}));
});

suite.test("prints quaternions with one sign per imaginary component", () => {
    assertThat(quaternionText(blochQuaternion(Math.PI / 2, 0))).isEqualTo("0.707 +0.000i +0.707j +0.000k");
    assertThat(quaternionText({w: 1, x: -1e-9, y: 0, z: -0.25})).isEqualTo("1.000 +0.000i +0.000j -0.250k");
    assertThat(pureQuaternionText({x: -0.5, y: 0, z: 0.866})).isEqualTo("-0.500i +0.000j +0.866k");
});

suite.test("names the trigonometry each component comes from, and says when it is scaled", () => {
    assertThat(componentFormulas(1)).isEqualTo({
        x: "sin θ cos ϕ", y: "sin θ sin ϕ", z: "cos θ", radial: "sin θ"});
    // A mixed state's vector is shorter, so every component carries its length.
    assertThat(componentFormulas(0.5)).isEqualTo({
        x: "|r| sin θ cos ϕ", y: "|r| sin θ sin ϕ", z: "|r| cos θ", radial: "|r| sin θ"});
    assertThat(componentFormulas(0.9995).z).isEqualTo("cos θ");
});
