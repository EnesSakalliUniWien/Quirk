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
import {Animation} from "../../../src/config/Animation.js"
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

suite.test("cycleTime follows the injected clock and wraps at a full cycle, with the transport stopped", () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);

    assertThat(sim.cycleTime()).isEqualTo(0);

    clock.advance(Animation.CYCLE_DURATION_MS / 4);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);

    clock.advance(Animation.CYCLE_DURATION_MS / 4);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.5);

    // A full further cycle lands back on the same phase.
    clock.advance(Animation.CYCLE_DURATION_MS);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.5);
});

suite.test("simulate reuses the computed stats while the circuit is unchanged", () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    // Both wires carry a gate, so withMinimumWireCount is an identity and a repeat is a cache hit.
    const c = circuit(`H-
                     -X`).withMinimumWireCount();

    const first = sim.simulate(c);
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    const second = sim.simulate(c);

    // A cache hit hands back the same underlying state. A still circuit leaves the cycle where it stands.
    assertTrue(second.finalState === first.finalState);
    assertThat(second.time).isEqualTo(first.time);
});

suite.test("simulate recomputes a time-dependent circuit every call, with the transport stopped", () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const c = circuit(`t-
                     --`);

    const first = sim.simulate(c);
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    const second = sim.simulate(c);

    assertFalse(second.finalState === first.finalState);
    assertThat(second.time).isApproximatelyEqualTo(0.125);
});

suite.test("a still circuit keeps the cycle where it stands, and a spinning one resumes from there", () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const spinning = circuit(`t-
                            --`);
    const still = circuit(`H-
                         -X`);

    clock.advance(Animation.CYCLE_DURATION_MS / 4);
    assertThat(sim.simulate(spinning).time).isApproximatelyEqualTo(0.25);
    clock.advance(Animation.CYCLE_DURATION_MS / 2);
    assertThat(sim.simulate(still).time).isApproximatelyEqualTo(0.25);
    // The time spent on the still circuit is skipped, not jumped over.
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    assertThat(sim.simulate(spinning).time).isApproximatelyEqualTo(0.375);
});

suite.test("a hold or a restored take stands the cycle still", () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    clock.advance(Animation.CYCLE_DURATION_MS / 4);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);

    const release = sim.holdClock();
    assertFalse(sim.clockRunning());
    clock.advance(Animation.CYCLE_DURATION_MS / 2);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);
    release();
    release();
    assertTrue(sim.clockRunning());
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.375);

    sim.restore({phase: 0.5, seed: "restored"});
    clock.advance(Animation.CYCLE_DURATION_MS / 4);
    assertThat(sim.cycleTime()).isEqualTo(0.5);
    // A new run lets go of the restored take, and the cycle moves on from its phase.
    sim.newRun();
    clock.advance(Animation.CYCLE_DURATION_MS / 4);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.75);
});

suite.test("a stopped animation stands still and moves only by the increments it is given", () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    clock.advance(Animation.CYCLE_DURATION_MS / 4);
    sim.setAnimationStopped(true);
    assertFalse(sim.clockRunning());
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);

    clock.advance(Animation.CYCLE_DURATION_MS / 2);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);
    sim.advanceCycle(2 * Animation.DEBUG_STEP_CYCLE_INCREMENT);
    assertThat(sim.simulate(circuit('t')).time).isApproximatelyEqualTo(0.25 + 2 * Animation.DEBUG_STEP_CYCLE_INCREMENT);
    // Backwards wraps below zero like forwards wraps past one.
    sim.advanceCycle(-0.5);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.75 + 2 * Animation.DEBUG_STEP_CYCLE_INCREMENT);

    // Resumed, the cycle moves on from where it stood, not from where the clock went meanwhile.
    clock.advance(Animation.CYCLE_DURATION_MS / 2);
    sim.setAnimationStopped(false);
    assertTrue(sim.clockRunning());
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.875 + 2 * Animation.DEBUG_STEP_CYCLE_INCREMENT);
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

suite.testUsingWebGL("a simulator keeping checkpoints re-runs from where the circuit changed, and gives them back", () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now, undefined, {keepCheckpoints: true});
    const c = circuit(`H-X-t-H
                     -HX--t-`);
    try {
        sim.simulate(c);
        clock.advance(Animation.CYCLE_DURATION_MS / 8);
        const resumed = sim.simulate(c);
        const fresh = new Simulator(clock.now).simulate(c, resumed.time);
        assertThat(resumed.toReadableJson()).isEqualTo(fresh.toReadableJson());
        assertThat(sim.simulateAtStep(c, 3, resumed.time).toReadableJson())
            .isEqualTo(new Simulator(clock.now).simulateAtStep(c, 3, resumed.time).toReadableJson());
    } finally {
        sim.releaseCheckpoints();
    }
});

suite.test("a lagging evaluate shows the last result until a newer phase is back, whole and at the playhead", async () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now, undefined, {keepCheckpoints: true});
    const c = circuit(`H-X-t-H
                     -HX--t-`);
    const arrival = async () => {
        for (let i = 0; i < 400 && sim.hasPendingRuns(); i++) {
            sim.evaluate(c, 2, 3, true, {mayLag: true});
            await new Promise(resolve => setTimeout(resolve, 5));
        }
    };
    try {
        const first = sim.evaluate(c, 2, 3);
        clock.advance(Animation.CYCLE_DURATION_MS / 8);

        // The frame shows what was there, while the GPU works on the new phase.
        assertTrue(sim.evaluate(c, 2, 3, true, {mayLag: true}) === first);
        assertTrue(sim.hasPendingRuns());

        await arrival();
        const arrived = sim.completed.getState().value;
        assertThat(arrived.phase).isApproximatelyEqualTo(0.125);
        assertThat(arrived.fullStats.time).isEqualTo(arrived.phase);
        assertThat(arrived.stats.time).isEqualTo(arrived.phase);
        const fresh = new Simulator(clock.now);
        fresh.seed = sim.seed;
        assertThat(arrived.fullStats.toReadableJson())
            .isEqualTo(fresh.simulate(c, arrived.phase).toReadableJson());
        assertThat(arrived.stats.toReadableJson())
            .isEqualTo(fresh.simulateAtStep(c, 3, arrived.phase).toReadableJson());
    } finally {
        sim.releaseCheckpoints();
    }
});

suite.test("a lagging evaluate waits as usual for anything but an animation step", () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now, undefined, {keepCheckpoints: true});
    try {
        const still = circuit(`H-X
                             -HX`);
        const result = sim.evaluate(still, 2, 3, true, {mayLag: true});
        assertThat(result.fullStats.circuitDefinition.columns.length).isEqualTo(still.columns.length);
        assertFalse(sim.hasPendingRuns());
    } finally {
        sim.releaseCheckpoints();
    }
});

suite.test("simulateAtStep clamps a negative step to the empty circuit", () => {
    const sim = new Simulator(manualClock().now);
    const c = circuit(`HX
                     --`);

    assertThat(sim.simulateAtStep(c, -1, 0).circuitDefinition.columns.length).isEqualTo(0);
});

suite.test("the cycle takes the duration the user sets, read afresh as it runs", () => {
    const clock = manualClock();
    let duration = 2000;
    const sim = new Simulator(clock.now, () => duration);
    clock.advance(500);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);
    // A slower cycle goes on from where the faster one stood, without jumping.
    duration = 8000;
    clock.advance(2000);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.5);
});
