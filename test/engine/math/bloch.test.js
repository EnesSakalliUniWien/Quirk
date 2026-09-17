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
import {EPSILON, BLOCH_PRESETS, blochCoordinates, blochReading, vectorFromAngles, blochVectorBetween, degreesText, pureStateText,
    blochQuaternion, blochAmplitudes, pureQuaternionText, quaternionText, componentFormulas,
    analyzerReadout} from "../../../src/engine/math/bloch.js"
import {projectPoint} from "../../../src/draw/displays/bloch/BlochScene.js"
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

suite.test("a maximally mixed state has no angles (RULE A)", () => {
    for (const vec of [{x: 0, y: 0, z: 0}, {x: EPSILON / 4, y: -EPSILON / 4, z: EPSILON / 4}]) {
        const reading = blochReading(vec);
        assertThat(reading.rule).isEqualTo("mixed");
        assertThat(reading.theta).isEqualTo(undefined);
        assertThat(reading.phi).isEqualTo(undefined);
        assertThat(reading.purity).isApproximatelyEqualTo(0.5);
    }
    assertThat(degreesText(blochReading({x: 0, y: 0, z: 0}).theta)).isEqualTo("—");
});

suite.test("on the z axis θ is 0 or 180° and ϕ does not exist (RULE B)", () => {
    const north = blochReading({x: 0, y: 0, z: 1});
    assertThat(north.rule).isEqualTo("polar");
    assertThat(degreesText(north.theta)).isEqualTo("0.0°");
    assertThat(north.phi).isEqualTo(undefined);

    const south = blochReading({x: 1e-9, y: 0, z: -1});
    assertThat(south.rule).isEqualTo("polar");
    assertThat(degreesText(south.theta)).isEqualTo("180.0°");
    assertThat(degreesText(south.phi)).isEqualTo("—");
});

suite.test("a general state has both angles (RULE C)", () => {
    const plus = blochReading({x: 1, y: 0, z: 0});
    assertThat(plus.rule).isEqualTo("general");
    assertThat(degreesText(plus.theta)).isEqualTo("90.0°");
    assertThat(degreesText(plus.phi)).isEqualTo("0.0°");
    assertThat(plus.purity).isApproximatelyEqualTo(1);

    const reading = blochReading(vectorFromAngles(1.1, -2.3, 0.6));
    assertThat(reading.r).isApproximatelyEqualTo(0.6);
    assertThat(reading.theta).isApproximatelyEqualTo(1.1);
    // The azimuth reads from 0 up to 2π, so −2.3 comes back as 2π − 2.3.
    assertThat(reading.phi).isApproximatelyEqualTo(2 * Math.PI - 2.3);
    assertThat(reading.purity).isApproximatelyEqualTo((1 + 0.36) / 2);
});

suite.test("a pure state moves between two others along the sphere, not through it", () => {
    const close = (v, x, y, z) => [v.x - x, v.y - y, v.z - z].every(d => Math.abs(d) < 1e-9);
    const zero = {x: 0, y: 0, z: 1}, plus = {x: 1, y: 0, z: 0}, one = {x: 0, y: 0, z: -1};
    assertTrue(close(blochVectorBetween(zero, plus, 0), 0, 0, 1));
    assertTrue(close(blochVectorBetween(zero, plus, 1), 1, 0, 0));
    assertTrue(close(blochVectorBetween(zero, plus, 0.5), Math.SQRT1_2, 0, Math.SQRT1_2));
    // Opposite poles take a half turn through the equator, keeping the arrow's full length.
    for (let t = 0; t <= 1; t += 0.125) {
        const v = blochVectorBetween(zero, one, t);
        assertThat(Math.hypot(v.x, v.y, v.z)).isApproximatelyEqualTo(1);
        assertThat(v.z).isApproximatelyEqualTo(Math.cos(Math.PI * t));
    }
    assertTrue(close(blochVectorBetween(zero, one, 0.5), 1, 0, 0));
    assertTrue(close(blochVectorBetween(plus, {x: -1, y: 0, z: 0}, 0.5), 0, 1, 0));
});

suite.test("a mixed state's arrow turns the same way while its length changes evenly", () => {
    const close = (v, x, y, z) => [v.x - x, v.y - y, v.z - z].every(d => Math.abs(d) < 1e-9);
    // To and from the centre the direction stays that of the other end.
    assertTrue(close(blochVectorBetween({x: 0, y: 0, z: 1}, {x: 0, y: 0, z: 0}, 0.5), 0, 0, 0.5));
    assertTrue(close(blochVectorBetween({x: 0, y: 0, z: 0}, {x: 0, y: 1, z: 0}, 0.25), 0, 0.25, 0));
    const half = blochVectorBetween({x: 0, y: 0, z: 0.5}, {x: 0.8, y: 0, z: 0}, 0.5);
    assertThat(Math.hypot(half.x, half.y, half.z)).isApproximatelyEqualTo(0.65);
    assertThat(half.x).isApproximatelyEqualTo(half.z);
});

suite.test("the presets are the six poles and the centre", () => {
    assertThat(BLOCH_PRESETS.map(p => p.name)).isEqualTo(["|0⟩", "|1⟩", "|+⟩", "|−⟩", "|i⟩", "|−i⟩", "Mixed"]);
    for (const {name, vec} of BLOCH_PRESETS) {
        assertThat(blochReading(vec).r).isApproximatelyEqualTo(name === "Mixed" ? 0 : 1);
    }
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
        const q = blochQuaternion(vectorFromAngles(theta, phi));
        assertThat(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z).isApproximatelyEqualTo(1);
        assertThat(rotate(q, {x: 0, y: 0, z: 1})).isApproximatelyEqualTo({
            x: Math.sin(theta) * Math.cos(phi), y: Math.sin(theta) * Math.sin(phi), z: Math.cos(theta)});
    }
});

suite.test("the state's quaternion holds its amplitudes: α = w and β = y - x i", () => {
    const q = blochQuaternion(vectorFromAngles(1.1, -2.3));
    const [α, β] = [new Complex(q.w, 0), new Complex(q.y, -q.x)];
    // In the simulator's convention: conj(α) β above the diagonal, as qubitMarginals notes.
    const ρ = Matrix.square(α.conjugate().times(α), α.conjugate().times(β),
        β.conjugate().times(α), β.conjugate().times(β));
    assertThat(blochCoordinates(ρ)).isApproximatelyEqualTo(rotate(q, {x: 0, y: 0, z: 1}));
});

suite.test("prints quaternions with one sign per imaginary component", () => {
    assertThat(quaternionText(blochQuaternion({x: 1, y: 0, z: 0}))).isEqualTo("0.707 +0.000i +0.707j +0.000k");
    assertThat(quaternionText({w: 1, x: -1e-9, y: 0, z: -0.25})).isEqualTo("1.000 +0.000i +0.000j -0.250k");
    assertThat(pureQuaternionText({x: -0.5, y: 0, z: 0.866})).isEqualTo("-0.500i +0.000j +0.866k");
});

suite.test("names the trigonometry each component comes from, and says when it is scaled", () => {
    assertThat(componentFormulas(blochReading(vectorFromAngles(1, 2)))).isEqualTo({
        x: "sin θ cos ϕ", y: "sin θ sin ϕ", z: "cos θ", radial: "sin θ"});
    // A mixed state's vector is shorter, so every component carries its length.
    assertThat(componentFormulas(blochReading(vectorFromAngles(1, 2, 0.5)))).isEqualTo({
        x: "|r| sin θ cos ϕ", y: "|r| sin θ sin ϕ", z: "|r| cos θ", radial: "|r| sin θ"});
});

suite.test("a formula exists only where its angles do", () => {
    // RULE A: no direction, so no formula at all.
    assertThat(componentFormulas(blochReading({x: 0, y: 0, z: 0}))).isEqualTo(
        {x: undefined, y: undefined, z: undefined, radial: undefined});
    // RULE B: nothing that names ϕ survives on the z axis.
    assertThat(componentFormulas(blochReading({x: 0, y: 0, z: -1}))).isEqualTo(
        {x: undefined, y: undefined, z: "cos θ", radial: "sin θ"});
});

suite.test("the amplitudes follow the same rules", () => {
    const plus = blochAmplitudes(blochReading({x: 1, y: 0, z: 0}));
    assertThat(plus.alpha).isApproximatelyEqualTo(Math.SQRT1_2);
    assertThat(plus.beta).isApproximatelyEqualTo(new Complex(Math.SQRT1_2, 0));
    const general = blochAmplitudes(blochReading(vectorFromAngles(1.1, -2.3)));
    assertThat(general.alpha).isApproximatelyEqualTo(Math.cos(0.55));
    assertThat(general.beta).isApproximatelyEqualTo(Complex.polar(Math.sin(0.55), -2.3));
    // The ket's phase convention fixes β at the poles even though its azimuth is undefined.
    assertThat(blochAmplitudes(blochReading({x: 0, y: 0, z: -1}))).isEqualTo({alpha: Math.cos(Math.PI / 2), beta: Complex.ONE});
    assertThat(blochAmplitudes(blochReading({x: 0, y: 0, z: 1}))).isEqualTo({alpha: 1, beta: Complex.ZERO});
    assertThat(blochAmplitudes(blochReading({x: 0, y: 0, z: 0}))).isEqualTo({alpha: undefined, beta: undefined});
    assertThat(blochQuaternion({x: 0, y: 0, z: 0})).isEqualTo(undefined);
});

suite.test("the readout says — for what is undefined, and keeps every row", () => {
    const mixed = analyzerReadout({x: 0, y: 0, z: 0});
    assertThat([mixed.theta, mixed.phi, mixed.quaternion]).isEqualTo(["—", "—", "—"]);
    assertThat(mixed.components.map(c => c.formula)).isEqualTo([undefined, undefined, undefined]);
    assertThat(mixed.amplitudes.map(a => a.value)).isEqualTo(["—", "—"]);
    assertThat(mixed.purity).isEqualTo("0.500");
    assertThat(mixed.note).isEqualTo("Maximally mixed — no Bloch direction defined");

    const south = analyzerReadout({x: 0, y: 0, z: -1});
    assertThat([south.theta, south.phi]).isEqualTo(["180.0°", "—"]);
    assertThat(south.components.map(c => c.formula)).isEqualTo([undefined, undefined, "cos θ"]);
    assertThat(south.amplitudes.map(a => a.value)).isEqualTo(["0.000", "+1.000+0.000i"]);
    assertThat(south.note).isEqualTo("ϕ undefined — vector lies on z-axis");

    const plus = analyzerReadout({x: 1, y: 0, z: 0});
    assertThat([plus.length, plus.theta, plus.phi, plus.purity]).isEqualTo(["1.000", "90.0°", "0.0°", "1.000"]);
    assertThat(plus.amplitudes.map(a => a.value)).isEqualTo(["0.707", "+0.707+0.000i"]);
    assertThat(plus.quaternion).isEqualTo("0.707 +0.000i +0.707j +0.000k");
    assertThat(plus.note).isEqualTo(undefined);
});

suite.test("partially mixed states have no pure-state amplitudes", () => {
    for (const vec of [{x: 0, y: 0, z: 0.5}, {x: 0.3, y: 0.4, z: 0}]) {
        assertThat(blochAmplitudes(blochReading(vec))).isEqualTo({alpha: undefined, beta: undefined});
        assertThat(analyzerReadout(vec).amplitudes.map(a => a.value)).isEqualTo(["—", "—"]);
    }
});

suite.test("near-pole quaternions retain the direction and ket phase", () => {
    for (const degrees of [0.05, 179.95]) {
        const vec = vectorFromAngles(degrees * Math.PI / 180, Math.PI / 4);
        const q = blochQuaternion(vec);
        assertThat(rotate(q, {x: 0, y: 0, z: 1})).isApproximatelyEqualTo(vec, 1e-9);
        const {alpha, beta} = blochAmplitudes(blochReading(vec));
        assertThat(q.w).isApproximatelyEqualTo(alpha, 1e-9);
        assertThat(new Complex(q.y, -q.x)).isApproximatelyEqualTo(beta, 1e-9);
    }
});

suite.test("at |1⟩ the quaternion is the half turn ϕ = 0 names, agreeing with the ket", () => {
    const q = blochQuaternion({x: 0, y: 0, z: -1});
    assertThat(q).isEqualTo({w: 0, x: 0, y: 1, z: 0});
    // α = w and β = y − x i: β is +1, as pureStateText(π, 0) writes it.
    assertThat(pureStateText(Math.PI, 0)).isEqualTo("0.000 |0⟩ + (+1.000+0.000i) |1⟩");
    assertThat(degreesText(blochReading({x: 0, y: -1, z: 0}).phi)).isEqualTo("270.0°");
});
