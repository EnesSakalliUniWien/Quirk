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

import {Suite, assertThat} from "../../../TestUtil.js"
import {initializedWglContext} from "../../../../src/engine/webgl/context/WglContext.js"
import {CircuitDefinition} from "../../../../src/circuit/model/CircuitDefinition.js"
import {GateColumn} from "../../../../src/circuit/model/GateColumn.js"
import {CircuitStats} from "../../../../src/engine/simulation/CircuitStats.js"
import {Gates} from "../../../../src/gates/AllGates.js"
import {Matrix} from "../../../../src/engine/math/matrix/Matrix.js"

const suite = new Suite("WglContext");

suite.test("the simulation runs again once a lost context is restored", async () => {
    // The browser drops a context when too many are open; it comes back with no extension enabled.
    const context = initializedWglContext();
    const lose = context.gl.getExtension("WEBGL_lose_context");
    if (lose === null) {
        assertThat(undefined);
        return;
    }
    // Waits for an event, failing rather than hanging the suite if it never comes.
    const event = name => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no ${name} event`)), 5000);
        context.canvas.addEventListener(name, () => {clearTimeout(timer); resolve();}, {once: true});
    });
    const lost = event("webglcontextlost");
    lose.loseContext();
    await lost;
    // Restoring is allowed only once the lost event has been dispatched and its default prevented,
    // which the browser records after the last listener returns.
    await new Promise(resolve => setTimeout(resolve, 0));
    const restored = event("webglcontextrestored");
    lose.restoreContext();
    await restored;

    const circuit = new CircuitDefinition(1, [new GateColumn([Gates.HalfTurns.H])]);
    const stats = CircuitStats.fromCircuitAtTime(circuit, 0);
    assertThat(stats.finalState).isApproximatelyEqualTo(Matrix.col(Math.SQRT1_2, Math.SQRT1_2), 1e-6);
});
