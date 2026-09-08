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

import {Suite, assertThat, assertTrue, assertFalse} from "../../TestUtil.js"
import {CircuitDefinition} from "../../../src/circuit/model/CircuitDefinition.js"
import {Gates} from "../../../src/gates/AllGates.js"
import {Simulation} from "../../../src/config/Simulation.js"
import {Simulator} from "../../../src/app/state/Simulator.js"

const suite = new Suite("Simulator");

/**
 * A clock the test winds by hand.
 * @returns {!{now: !function(): !number, advance: !function(!number): void}}
 */
function manualClock() {
    let millis = 1000;
    return {
        now: () => millis,
        advance: dMillis => { millis += dMillis; }
    };
}

const circuit = diagram => CircuitDefinition.fromTextDiagram(new Map([
    ['H', Gates.HalfTurns.H],
    ['X', Gates.HalfTurns.X],
    ['t', Gates.Powering.XForward],
    ['-', undefined]
]), diagram);

suite.test("cycleTime follows the injected clock and wraps at a full cycle", () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);

    assertThat(sim.cycleTime()).isEqualTo(0);

    clock.advance(Simulation.CYCLE_DURATION_MS / 4);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);

    clock.advance(Simulation.CYCLE_DURATION_MS / 4);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.5);

    // A full further cycle lands back on the same phase.
    clock.advance(Simulation.CYCLE_DURATION_MS);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.5);
});

suite.test("simulate reuses the computed stats while the circuit is unchanged", () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    // Both wires carry a gate, so withMinimumWireCount is an identity and a repeat is a cache hit.
    const c = circuit(`H-
                     -X`).withMinimumWireCount();

    const first = sim.simulate(c);
    clock.advance(Simulation.CYCLE_DURATION_MS / 8);
    const second = sim.simulate(c);

    // A cache hit hands back the same underlying state, re-stamped with the current time.
    assertTrue(second.finalState === first.finalState);
    assertThat(second.time).isApproximatelyEqualTo(0.125);
});

suite.test("simulate recomputes a time-dependent circuit every call", () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const c = circuit(`t-
                     --`);

    const first = sim.simulate(c);
    clock.advance(Simulation.CYCLE_DURATION_MS / 8);
    const second = sim.simulate(c);

    assertFalse(second.finalState === first.finalState);
});

suite.test("simulateAtStep runs the truncated circuit without evicting the whole-circuit cache", () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const c = circuit(`HX
                     --`).withMinimumWireCount();

    const whole = sim.simulate(c);
    const atStep = sim.simulateAtStep(c, 1, 0);
    assertThat(atStep.circuitDefinition.columns.length).isEqualTo(1);

    // The playhead's stats live in their own cache, so the full circuit is still a cache hit.
    const wholeAgain = sim.simulate(c);
    assertTrue(wholeAgain.finalState === whole.finalState);

    // And the truncated circuit is a cache hit of its own.
    const atStepAgain = sim.simulateAtStep(c, 1, 0);
    assertTrue(atStepAgain.finalState === atStep.finalState);
});

suite.test("simulateAtStep clamps a negative step to the empty circuit", () => {
    const sim = new Simulator(manualClock().now);
    const c = circuit(`HX
                     --`);

    assertThat(sim.simulateAtStep(c, -1, 0).circuitDefinition.columns.length).isEqualTo(0);
});
