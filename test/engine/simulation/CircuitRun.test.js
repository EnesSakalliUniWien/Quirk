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

import { Suite, assertThat, assertTrue } from "../../TestUtil.js";
import { CircuitDefinition } from "../../../src/circuit/model/CircuitDefinition.js";
import { CircuitStats } from "../../../src/engine/simulation/CircuitStats.js";
import { Gates } from "../../../src/gates/AllGates.js";
import { Shaders } from "../../../src/engine/webgl/operations/Shaders.js";
import { StablePrefix } from "../../../src/engine/simulation/StablePrefix.js";
import { WglTexturePool } from "../../../src/engine/webgl/texture/WglTexturePool.js";
import { randomCircuit } from "./randomCircuits.js";
import { statsDifference } from "./statsComparison.js";

const suite = new Suite("CircuitRun");

const circuit = (diagram, ...extras) =>
  CircuitDefinition.fromTextDiagram(
    new Map([
      ...extras,
      ["H", Gates.HalfTurns.H],
      ["X", Gates.HalfTurns.X],
      ["S", Gates.QuarterTurns.SqrtZForward],
      ["t", Gates.Powering.XForward],
      ["•", Gates.Controls.Control],
      ["@", Gates.Displays.BlochSphereDisplay],
      ["-", undefined],
      ["/", null],
    ]),
    diagram,
  );

/** The circuit with only the columns a playhead that has run `step` of them has run. */
const truncatedTo = (definition, step) =>
  definition.withColumns(definition.columns.slice(0, step));

/**
 * Waits for a pending result, a frame at a time as the app does. A fence cannot signal in the task that
 * made it, so the first poll always finds nothing.
 *
 * @param {!function(): *} poll
 * @returns {!Promise.<*>}
 */
async function settled(poll) {
  const deadline = performance.now() + 10000;
  for (;;) {
    const result = poll();
    if (result !== undefined) {
      return result;
    }
    if (performance.now() > deadline) {
      throw new Error("The GPU never answered.");
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

suite.testUsingWebGL(
  "the playhead's stats are the first columns of one run, as a run of just them gives",
  () => {
    // Stats of the columns that have run are the first columns' stats of the whole circuit, and the
    // state at the playhead is the state the whole run had then. This holds for every step.
    for (const definition of [
      circuit(`-H-S-t-@-X-
                 -----•-X-@-`),
      // A circuit whose first columns leave its last wire alone: the playhead's circuit is smaller.
      circuit(`-H-@-X-t-
                 -----@---
                 -------H-`),
    ]) {
      const whole = definition.withMinimumWireCount();
      for (let step = 0; step < whole.columns.length; step++) {
        const playhead = truncatedTo(definition, step);
        const { fullStats, stats } = CircuitStats.fromCircuitAtTimeWithPlayhead(
          definition,
          playhead,
          0.3,
          "seed",
        );
        assertThat(
          statsDifference(
            fullStats,
            CircuitStats.fromCircuitAtTime(definition, 0.3, "seed"),
          ),
        )
          .withInfo({ step })
          .isEqualTo(undefined);
        assertThat(
          statsDifference(
            stats,
            CircuitStats.fromCircuitAtTime(playhead, 0.3, "seed"),
          ),
        )
          .withInfo({ step })
          .isEqualTo(undefined);
        assertTrue(
          stats.circuitDefinition.isEqualTo(playhead.withMinimumWireCount()),
        );
      }
    }
  },
);

suite.testUsingWebGL(
  "random circuits give the playhead's stats from one run, at every step",
  () => {
    let smaller = 0;
    let steps = 0;
    for (let i = 0; i < 40; i++) {
      const definition = randomCircuit(`playhead ${i}`).withMinimumWireCount();
      const seed = `seed ${i}`;
      const time = 0.15 + (i % 5) * 0.2;
      const prefix = new StablePrefix();
      const expectedWhole = CircuitStats.fromCircuitAtTime(
        definition,
        time,
        seed,
      );
      // Each step asks of a prefix the one before made, or of none: the state is from the whole run
      // or from the kept prefix, for every step on either side of its columns.
      for (const kept of [undefined, prefix]) {
        for (let step = 0; step < definition.columns.length; step++) {
          const playhead = truncatedTo(definition, step);
          const { fullStats, stats } =
            CircuitStats.fromCircuitAtTimeWithPlayhead(
              definition,
              playhead,
              time,
              seed,
              kept,
            );
          const info = { circuit: definition.toString(), step, time, seed };
          assertThat(statsDifference(fullStats, expectedWhole))
            .withInfo(info)
            .isEqualTo(undefined);
          const expected = CircuitStats.fromCircuitAtTime(playhead, time, seed);
          // The wires the playhead's circuit leaves out stay |0>; summing them in rounds a little
          // differently, so the stats are the same to a rounding.
          assertThat(statsDifference(stats, expected, 1e-6))
            .withInfo(info)
            .isEqualTo(undefined);
          if (playhead.withMinimumWireCount().numWires < definition.numWires) {
            smaller++;
          }
          steps++;
        }
      }
      prefix.release();
    }
    assertTrue(
      steps > 300 && smaller > 100,
      `${steps} steps, ${smaller} of a smaller circuit`,
    );
  },
);

suite.testUsingWebGL(
  "a playhead before the first moving column is made from a run of its own",
  () => {
    // The kept prefix begins after the playhead's columns, so the run has no state there to take.
    const definition = circuit(`-H-S-t-@-
                                -----•-X-`).withMinimumWireCount();
    const prefix = new StablePrefix();
    CircuitStats.fromCircuitAtTime(definition, 0.2, "seed", prefix);
    for (const step of [0, 1, 3, 5, 6]) {
      const playhead = truncatedTo(definition, step);
      const { fullStats, stats } = CircuitStats.fromCircuitAtTimeWithPlayhead(
        definition,
        playhead,
        0.6,
        "seed",
        prefix,
      );
      assertThat(
        statsDifference(
          fullStats,
          CircuitStats.fromCircuitAtTime(definition, 0.6, "seed"),
        ),
      ).isEqualTo(undefined);
      assertThat(
        statsDifference(
          stats,
          CircuitStats.fromCircuitAtTime(playhead, 0.6, "seed"),
          1e-6,
        ),
      ).isEqualTo(undefined);
    }
    prefix.release();
  },
);

suite.test(
  "stats read without waiting for the GPU are those a waiting read gives",
  async () => {
    const before = WglTexturePool.getUnReturnedTextureCount();
    for (let i = 0; i < 25; i++) {
      const definition = randomCircuit(`pending ${i}`).withMinimumWireCount();
      const seed = `pending seed ${i}`;
      const time = 0.1 + (i % 4) * 0.25;
      const prefix = new StablePrefix();
      // Make the prefix as the app does, with a read that waits, and then read the way a frame does.
      CircuitStats.fromCircuitAtTime(definition, time, seed, prefix);
      const step = i % (definition.columns.length + 1);
      const playhead =
        step < definition.columns.length
          ? truncatedTo(definition, step)
          : undefined;

      const pending = CircuitStats.startFromCircuitAtTime(
        definition,
        playhead,
        time + 0.05,
        seed,
        prefix,
      );
      // The fence cannot signal in the task that made it.
      assertThat(pending.poll()).isEqualTo(undefined);
      const { fullStats, stats } = await settled(() => pending.poll());
      const info = { circuit: definition.toString(), step, i };
      assertThat(
        statsDifference(
          fullStats,
          CircuitStats.fromCircuitAtTime(definition, time + 0.05, seed),
        ),
      )
        .withInfo(info)
        .isEqualTo(undefined);
      if (playhead !== undefined && stats !== undefined) {
        assertThat(
          statsDifference(
            stats,
            CircuitStats.fromCircuitAtTime(playhead, time + 0.05, seed),
            1e-6,
          ),
        )
          .withInfo(info)
          .isEqualTo(undefined);
      }
      // Asking again hands back the same.
      assertTrue(pending.poll().fullStats === fullStats);
      prefix.release();
    }
    // Every texture went back to the pool, though the data had not arrived when they did.
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
  },
);

suite.test(
  "a read in the background gives the stats for the time it was started at, however long it takes",
  async () => {
    const definition = circuit(`-H-t-@-`).withMinimumWireCount();
    const pending = CircuitStats.startFromCircuitAtTime(
      definition,
      undefined,
      0.2,
      "seed",
    );
    // Another run is started and finished while the first has not been asked for: results do not mix.
    const other = CircuitStats.fromCircuitAtTime(definition, 0.8, "seed");
    const result = await settled(() => pending.poll());
    assertThat(
      statsDifference(
        result.fullStats,
        CircuitStats.fromCircuitAtTime(definition, 0.2, "seed"),
      ),
    ).isEqualTo(undefined);
    assertTrue(statsDifference(result.fullStats, other) !== undefined);
    assertThat(result.stats).isEqualTo(undefined);
  },
);

suite.test(
  "a cancelled read gives back what it held and leaves the context fit for the next",
  async () => {
    const before = WglTexturePool.getUnReturnedTextureCount();
    const definition = circuit(`-H-t-@-`).withMinimumWireCount();
    const prefix = new StablePrefix();
    // The first run of a prefix keeps a copy of the state, which a read that is dropped must give back.
    const pending = CircuitStats.startFromCircuitAtTime(
      definition,
      undefined,
      0.2,
      "seed",
      prefix,
    );
    pending.cancel();
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
    let threw = false;
    try {
      pending.poll();
    } catch {
      threw = true;
    }
    assertTrue(threw);
    assertThat(
      statsDifference(
        CircuitStats.fromCircuitAtTime(definition, 0.2, "seed", prefix),
        CircuitStats.fromCircuitAtTime(definition, 0.2, "seed"),
      ),
    ).isEqualTo(undefined);
    prefix.release();
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
  },
);

suite.test(
  "a cancelled read with a playhead gives each texture back once, and leaves the pool sound",
  async () => {
    const before = WglTexturePool.getUnReturnedTextureCount();
    const definition = circuit(`-H-t-@-X-
                                -----•---`).withMinimumWireCount();
    const prefix = new StablePrefix();
    // Cancelled at once, and cancelled after the GPU has finished, with and without a prefix to fill.
    for (const [step, kept] of [
      [2, undefined],
      [4, undefined],
      [4, prefix],
      [6, prefix],
    ]) {
      const pending = CircuitStats.startFromCircuitAtTime(
        definition,
        truncatedTo(definition, step),
        0.2,
        "seed",
        kept,
      );
      if (step === 6) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      pending.cancel();
      assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
    }
    // A texture given back twice would poison the pool: drawing into one taken out of it would throw.
    for (let sizePower = 0; sizePower <= 8; sizePower++) {
      const taken = Array.from({ length: 6 }, () =>
        WglTexturePool.takeRawFloatTex(sizePower),
      );
      for (const texture of taken) {
        Shaders.color(1, 2, 3, 4).renderTo(texture);
      }
      for (const texture of taken) {
        texture.deallocByDepositingInPool();
      }
    }
    prefix.release();
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
  },
);
