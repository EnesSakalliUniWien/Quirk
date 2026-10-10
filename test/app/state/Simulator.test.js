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

import { Suite, assertThat, assertTrue, assertFalse } from "../../TestUtil.js";
import { CircuitDefinition } from "../../../src/circuit/model/CircuitDefinition.js";
import { CircuitStats } from "../../../src/engine/simulation/CircuitStats.js";
import { Gates } from "../../../src/gates/AllGates.js";
import { Animation } from "../../../src/config/Animation.js";
import { Simulator } from "../../../src/app/state/Simulator.js";
import { WglTexturePool } from "../../../src/engine/webgl/texture/WglTexturePool.js";
import { initializedWglContext } from "../../../src/engine/webgl/context/WglContext.js";
import { statsDifference } from "../../engine/simulation/statsComparison.js";

const suite = new Suite("Simulator");

/**
 * A clock the test winds by hand.
 * @returns {!{now: !function(): !number, advance: !function(!number): void}}
 */
function manualClock() {
  let millis = 1000;
  return {
    now: () => millis,
    advance: (dMillis) => {
      millis += dMillis;
    },
  };
}

const circuit = (diagram) =>
  CircuitDefinition.fromTextDiagram(
    new Map([
      ["H", Gates.HalfTurns.H],
      ["X", Gates.HalfTurns.X],
      ["t", Gates.Powering.XForward],
      ["-", undefined],
    ]),
    diagram,
  );

suite.test(
  "cycleTime follows the injected clock and wraps at a full cycle, with the transport stopped",
  () => {
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
  },
);

suite.test(
  "simulate reuses the computed stats while the circuit is unchanged",
  () => {
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
  },
);

suite.test(
  "simulate recomputes a time-dependent circuit every call, with the transport stopped",
  () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const c = circuit(`t-
                     --`);

    const first = sim.simulate(c);
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    const second = sim.simulate(c);

    assertFalse(second.finalState === first.finalState);
    assertThat(second.time).isApproximatelyEqualTo(0.125);
  },
);

suite.test(
  "a still circuit keeps the cycle where it stands, and a spinning one resumes from there",
  () => {
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
  },
);

suite.test("a hold or a restored take stands the cycle still", () => {
  const clock = manualClock();
  const sim = new Simulator(clock.now);
  clock.advance(Animation.CYCLE_DURATION_MS / 4);
  assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);

  const release = sim.holdClock("recording");
  assertFalse(sim.clockRunning());
  clock.advance(Animation.CYCLE_DURATION_MS / 2);
  assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);
  release();
  release();
  assertTrue(sim.clockRunning());
  clock.advance(Animation.CYCLE_DURATION_MS / 8);
  assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.375);

  sim.restore({ phase: 0.5, seed: "restored" });
  clock.advance(Animation.CYCLE_DURATION_MS / 4);
  assertThat(sim.cycleTime()).isEqualTo(0.5);
  // A new run lets go of the restored take, and the cycle moves on from its phase.
  sim.newRun();
  clock.advance(Animation.CYCLE_DURATION_MS / 4);
  assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.75);
});

suite.test(
  "cycleHold names what stands the cycle still, a restored take before anything else",
  () => {
    const sim = new Simulator(manualClock().now);
    const hold = () => sim.cycleHold.getState().value;
    assertThat(hold()).isEqualTo(undefined);
    const releasePause = sim.holdClock("paused");
    assertThat(hold()).isEqualTo("paused");
    const releaseRecording = sim.holdClock("recording");
    assertThat(hold()).isEqualTo("recording");
    sim.restore({ phase: 0.5, seed: "restored" });
    assertThat(hold()).isEqualTo("take");

    sim.newRun();
    assertThat(hold()).isEqualTo("recording");
    releaseRecording();
    assertThat(hold()).isEqualTo("paused");
    releasePause();
    assertThat(hold()).isEqualTo(undefined);
    assertTrue(sim.clockRunning());
  },
);

suite.test(
  "setPhase puts the cycle at a phase, held or running, and a running one runs on from it",
  () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const release = sim.holdClock("paused");
    sim.setPhase(1.25);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);
    sim.setPhase(-0.25);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.75);
    clock.advance(Animation.CYCLE_DURATION_MS / 4);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.75);

    release();
    sim.setPhase(0.5);
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.625);
  },
);

suite.test(
  "the speed sets how fast the cycle runs, and a change carries the phase on without a jump",
  () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    sim.setSpeed(2);
    // The time run before the change counts at the speed it ran at.
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.125);
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.375);
    sim.setSpeed(0.25);
    clock.advance(Animation.CYCLE_DURATION_MS / 2);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.5);
  },
);

suite.test(
  "a held cycle moves only by the nudges it is given, wrapping both ways",
  () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    clock.advance(Animation.CYCLE_DURATION_MS / 4);
    // The frame loop reads the phase every frame, and a hold keeps the last one read: a pause stands
    // t where the canvas shows it.
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);
    const release = sim.holdClock("paused");
    assertFalse(sim.clockRunning());
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);

    clock.advance(Animation.CYCLE_DURATION_MS / 2);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(0.25);
    sim.advanceCycle(2 * Animation.T_NUDGE);
    assertThat(sim.simulate(circuit("t")).time).isApproximatelyEqualTo(
      0.25 + 2 * Animation.T_NUDGE,
    );
    // Backwards wraps below zero like forwards wraps past one.
    sim.advanceCycle(-0.5);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(
      0.75 + 2 * Animation.T_NUDGE,
    );

    // Let go, the cycle moves on from where it stood, not from where the clock went meanwhile.
    clock.advance(Animation.CYCLE_DURATION_MS / 2);
    release();
    assertTrue(sim.clockRunning());
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    assertThat(sim.cycleTime()).isApproximatelyEqualTo(
      0.875 + 2 * Animation.T_NUDGE,
    );
  },
);

suite.test(
  "simulateAtStep runs the truncated circuit without evicting the whole-circuit cache",
  () => {
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
  },
);

suite.test("simulateAtStep clamps a negative step to the empty circuit", () => {
  const sim = new Simulator(manualClock().now);
  const c = circuit(`HX
                     --`);

  assertThat(
    sim.simulateAtStep(c, -1, 0).circuitDefinition.columns.length,
  ).isEqualTo(0);
});

const richCircuit = (diagram) =>
  CircuitDefinition.fromTextDiagram(
    new Map([
      ["H", Gates.HalfTurns.H],
      ["X", Gates.HalfTurns.X],
      ["S", Gates.QuarterTurns.SqrtZForward],
      ["t", Gates.Powering.XForward],
      ["•", Gates.Controls.Control],
      ["@", Gates.Displays.BlochSphereDisplay],
      ["-", undefined],
    ]),
    diagram,
  );

/**
 * Counts what the shared GL context is asked to do while the body runs, by call name.
 * @param {!Array.<!string>} names
 * @param {!function(): *} body Its promise, if it returns one, is awaited.
 * @returns {!Promise.<!Object.<!string, !int>>}
 */
async function counting(names, body) {
  const gl = initializedWglContext().gl;
  const counts = Object.fromEntries(names.map((name) => [name, 0]));
  for (const name of names) {
    const original = gl[name];
    gl[name] = function (...args) {
      counts[name]++;
      return original.apply(this, args);
    };
  }
  try {
    await body();
  } finally {
    for (const name of names) {
      delete gl[name];
    }
  }
  return counts;
}

/** Frames of a moving circuit with the clock running, until a run in the background has landed. */
async function frameUntilNewResult(
  sim,
  clock,
  c,
  step,
  previous,
  mayLag = true,
) {
  for (let frame = 0; frame < 1000; frame++) {
    clock.advance(Animation.CYCLE_DURATION_MS / 500);
    const result = sim.evaluate(c, c.numWires, step, true, mayLag);
    if (result !== previous) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("No result came.");
}

suite.test(
  "evaluate gives the playhead's stats from the run that gives the whole circuit's, not a second",
  async () => {
    const sim = new Simulator(manualClock().now);
    const c = richCircuit(`-H-S-@-X-
                           -----•-@-`).withMinimumWireCount();
    for (const step of [0, 1, 3, 5]) {
      let result;
      const counts = await counting(["readPixels"], () => {
        result = sim.evaluate(c, c.numWires, step, false);
      });
      // One readback for the two sets of stats.
      assertThat(counts.readPixels).withInfo({ step }).isEqualTo(1);
      const truncated = c.withColumns(c.columns.slice(0, step));
      assertThat(
        statsDifference(
          result.stats,
          CircuitStats.fromCircuitAtTime(truncated, result.phase, sim.seed),
          1e-6,
        ),
      )
        .withInfo({ step })
        .isEqualTo(undefined);
      assertThat(
        statsDifference(
          result.fullStats,
          CircuitStats.fromCircuitAtTime(c, result.phase, sim.seed),
        ),
      )
        .withInfo({ step })
        .isEqualTo(undefined);
      assertThat(
        statsDifference(
          result.stats,
          sim.simulateAtStep(c, step, result.phase),
          1e-6,
        ),
      ).isEqualTo(undefined);
    }
    // At the end of the circuit the playhead's stats are the whole circuit's.
    const atEnd = sim.evaluate(c, c.numWires, c.columns.length, false);
    assertTrue(atEnd.stats === atEnd.fullStats);
    sim.dispose();
  },
);

suite.test(
  "a spinning circuit with the playhead inside it is run once a frame, from the state its still columns leave",
  async () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const c = richCircuit(`-H-S-t-@-X-
                           -----•---@-`).withMinimumWireCount();
    const before = WglTexturePool.getUnReturnedTextureCount();
    sim.evaluate(c, c.numWires, 7);
    // The state after the columns before the first that moves is kept, as one texture.
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(
      before + 1,
    );
    for (let frame = 0; frame < 4; frame++) {
      clock.advance(Animation.CYCLE_DURATION_MS / 16);
      let result;
      const counts = await counting(["readPixels"], () => {
        result = sim.evaluate(c, c.numWires, 7);
      });
      assertThat(counts.readPixels).isEqualTo(1);
      assertThat(
        statsDifference(
          result.fullStats,
          CircuitStats.fromCircuitAtTime(c, result.phase, sim.seed),
        ),
      ).isEqualTo(undefined);
      const truncated = c.withColumns(c.columns.slice(0, 7));
      assertThat(
        statsDifference(
          result.stats,
          CircuitStats.fromCircuitAtTime(truncated, result.phase, sim.seed),
          1e-6,
        ),
      ).isEqualTo(undefined);
    }
    // A playhead short of the first gate that moves stays as it is, and needs no run of its own either.
    const early = sim.evaluate(c, c.numWires, 2);
    clock.advance(Animation.CYCLE_DURATION_MS / 16);
    let later;
    const counts = await counting(["readPixels"], () => {
      later = sim.evaluate(c, c.numWires, 2);
    });
    assertThat(counts.readPixels).isEqualTo(1);
    assertThat(
      statsDifference(later.stats, early.stats.withTime(later.phase)),
    ).isEqualTo(undefined);
    sim.dispose();
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
  },
);

suite.test(
  "a frame that may lag gets the last result while a run in the background lands, then the next",
  async () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const c = richCircuit(`-H-S-t-@-
                           -----•---`).withMinimumWireCount();
    const before = WglTexturePool.getUnReturnedTextureCount();

    // The first frame has nothing to show yet, so it is run at once.
    const first = sim.evaluate(c, c.numWires, c.columns.length, true, true);
    assertThat(
      statsDifference(
        first.fullStats,
        CircuitStats.fromCircuitAtTime(c, first.phase, sim.seed),
      ),
    ).isEqualTo(undefined);

    const landed = [first];
    const counts = await counting(["readPixels", "fenceSync"], async () => {
      while (landed.length < 6) {
        landed.push(
          await frameUntilNewResult(
            sim,
            clock,
            c,
            c.columns.length,
            landed.at(-1),
          ),
        );
        // What lands is the stats of an earlier phase than the frame it is shown in.
        assertTrue(landed.at(-1).phase > landed.at(-2).phase);
        assertTrue(landed.at(-1).phase < sim.cycleTime());
        assertTrue(sim.completed.getState().value === landed.at(-1));
      }
    });
    // No frame waited on the GPU: every read was into a buffer, behind a fence.
    assertThat(counts.readPixels).isEqualTo(counts.fenceSync);
    assertTrue(counts.fenceSync >= 5);
    // And each result is that of the run made for the phase it carries.
    for (const result of landed) {
      assertThat(
        statsDifference(
          result.fullStats,
          CircuitStats.fromCircuitAtTime(c, result.phase, sim.seed),
        ),
      ).isEqualTo(undefined);
    }
    sim.dispose();
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
  },
);

suite.test(
  "a frame that may lag does not, after an edit, for a new step or run, or while time stands still",
  async () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const c = richCircuit(`-H-S-t-@-
                           -----•---`).withMinimumWireCount();
    const edited = richCircuit(`-H-S-t-@-
                                -----•-X-`).withMinimumWireCount();
    const frame = (circuit, step = circuit.columns.length) =>
      sim.evaluate(circuit, circuit.numWires, step, true, true);
    const same = (result, circuit, step = circuit.columns.length) => {
      assertTrue(
        result.circuit.isEqualTo(circuit) &&
          result.step === step &&
          result.seed === sim.seed,
      );
      const expected = CircuitStats.fromCircuitAtTime(
        circuit,
        result.phase,
        result.seed,
      );
      assertThat(statsDifference(result.fullStats, expected)).isEqualTo(
        undefined,
      );
    };

    frame(c);
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    // Now a run is under way in the background. An edit gets its own result at once.
    const lagging = frame(c);
    same(lagging, c);
    let counts = await counting(["fenceSync"], () => {
      clock.advance(Animation.CYCLE_DURATION_MS / 8);
      same(frame(edited), edited);
    });
    assertThat(counts.fenceSync).isEqualTo(0);
    // So does a step the playhead has moved to, and a new run with a fresh seed.
    same(frame(edited, 2), edited, 2);
    sim.newRun();
    same(frame(edited, 2), edited, 2);
    same(frame(edited), edited);

    // With the cycle held there is no next time to run for: the result is the one for the phase it
    // stands at, with nothing left to wait for.
    const release = sim.holdClock("paused");
    const held = frame(edited);
    same(held, edited);
    counts = await counting(["readPixels", "fenceSync"], async () => {
      for (let i = 0; i < 3; i++) {
        clock.advance(Animation.CYCLE_DURATION_MS / 8);
        assertTrue(frame(edited) === held);
      }
    });
    assertThat(counts.fenceSync).isEqualTo(0);
    release();

    // A circuit that does not move with time is not run in the background either.
    const still = richCircuit(`-H-S-@-X-`).withMinimumWireCount();
    same(frame(still), still);
    counts = await counting(["fenceSync"], () => {
      clock.advance(Animation.CYCLE_DURATION_MS / 8);
      same(frame(still), still);
    });
    assertThat(counts.fenceSync).isEqualTo(0);
    sim.dispose();
  },
);

suite.test(
  "a frame that may lag shows no stats of the wrong circuit however the edits fall",
  async () => {
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const a = richCircuit(`-H-S-t-@-
                           -----•---`).withMinimumWireCount();
    const b = richCircuit(`-H-S-t-@-
                           -----•-X-`).withMinimumWireCount();
    const shown = [];
    for (let frame = 0; frame < 24; frame++) {
      clock.advance(Animation.CYCLE_DURATION_MS / 64);
      // Edits land between frames, at different points of a run in the background.
      const circuit = frame % 7 < 3 ? a : b;
      const result = sim.evaluate(
        circuit,
        circuit.numWires,
        circuit.columns.length,
        true,
        true,
      );
      assertTrue(result.circuit.isEqualTo(circuit));
      assertThat(
        statsDifference(
          result.fullStats,
          CircuitStats.fromCircuitAtTime(circuit, result.phase, result.seed),
        ),
      )
        .withInfo({ frame })
        .isEqualTo(undefined);
      shown.push(result);
      if (frame % 3 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    sim.dispose();
  },
);

suite.test(
  "a run in the background that loses its context is run again once the context is back",
  async () => {
    const context = initializedWglContext();
    const lose = context.gl.getExtension("WEBGL_lose_context");
    if (lose === null) {
      assertThat(undefined);
      return;
    }
    const clock = manualClock();
    const sim = new Simulator(clock.now);
    const c = richCircuit(`-H-S-t-@-
                           -----•-X-`).withMinimumWireCount();
    const before = WglTexturePool.getUnReturnedTextureCount();
    const first = sim.evaluate(c, c.numWires, c.columns.length, true, true);
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    // The run starts and is left waiting on the GPU.
    assertTrue(
      sim.evaluate(c, c.numWires, c.columns.length, true, true) === first,
    );

    const event = (name) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`no ${name} event`)),
          5000,
        );
        context.canvas.addEventListener(
          name,
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
    const lost = event("webglcontextlost");
    lose.loseContext();
    await lost;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const restored = event("webglcontextrestored");
    lose.restoreContext();
    await restored;

    // The frame after has nothing to read, and runs the circuit at once on the restored context.
    clock.advance(Animation.CYCLE_DURATION_MS / 8);
    const after = sim.evaluate(c, c.numWires, c.columns.length, true, true);
    assertTrue(after !== first);
    assertThat(
      statsDifference(
        after.fullStats,
        CircuitStats.fromCircuitAtTime(c, after.phase, sim.seed),
      ),
    ).isEqualTo(undefined);
    assertFalse(after.fullStats.finalState.hasNaN());
    sim.dispose();
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
  },
);
