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

import {Suite, assertThat, assertTrue} from "../TestUtil.js"
import {blochCoordinates, blochAngles, pureStateText, projectPoint} from "../../src/app/blochSphereDialog.js"
import {Matrix} from "../../src/math/Matrix.js"

let suite = new Suite("blochSphereDialog");

suite.test("maps the basis states to the conventional poles", () => {
    let ground = blochCoordinates(Matrix.square(1, 0, 0, 0));
    assertThat(ground.x).isApproximatelyEqualTo(0);
    assertThat(ground.y).isApproximatelyEqualTo(0);
    assertThat(ground.z).isApproximatelyEqualTo(1);

    let excited = blochCoordinates(Matrix.square(0, 0, 0, 1));
    assertThat(excited.z).isApproximatelyEqualTo(-1);

    let plus = blochCoordinates(Matrix.square(0.5, 0.5, 0.5, 0.5));
    assertThat(plus.x).isApproximatelyEqualTo(1);
    assertThat(plus.y).isApproximatelyEqualTo(0);
    assertThat(plus.z).isApproximatelyEqualTo(0);
});

suite.test("reads the angles off the vector", () => {
    let ground = blochAngles({x: 0, y: 0, z: 1});
    assertThat(ground.r).isApproximatelyEqualTo(1);
    assertThat(ground.theta).isApproximatelyEqualTo(0);

    let plus = blochAngles({x: 1, y: 0, z: 0});
    assertThat(plus.theta).isApproximatelyEqualTo(Math.PI / 2);
    assertThat(plus.phi).isApproximatelyEqualTo(0);

    let mixed = blochAngles({x: 0, y: 0, z: 0});
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
    let px = projectPoint(1, 0, 0, 0, 0);
    assertThat(px.sx).isApproximatelyEqualTo(0);
    assertThat(px.sy).isApproximatelyEqualTo(0);
    assertThat(px.depth).isApproximatelyEqualTo(1);

    let py = projectPoint(0, 1, 0, 0, 0);
    assertThat(py.sx).isApproximatelyEqualTo(1);
    assertThat(py.depth).isApproximatelyEqualTo(0);

    let pz = projectPoint(0, 0, 1, 0, 0);
    assertThat(pz.sy).isApproximatelyEqualTo(1);
    assertThat(pz.depth).isApproximatelyEqualTo(0);
});
