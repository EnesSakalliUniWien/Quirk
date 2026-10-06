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
import { GateColumn } from "../../../src/circuit/model/GateColumn.js";
import { Gates } from "../../../src/gates/AllGates.js";
import { Shaders } from "../../../src/engine/webgl/operations/Shaders.js";
import { StablePrefix } from "../../../src/engine/simulation/StablePrefix.js";
import { WglTexturePool } from "../../../src/engine/webgl/texture/WglTexturePool.js";
import { initializedWglContext } from "../../../src/engine/webgl/context/WglContext.js";
import { randomCircuit } from "./randomCircuits.js";
import { statsDifference } from "./statsComparison.js";

const suite = new Suite("StablePrefix");

const circuit = (diagram, ...extras) =>
  CircuitDefinition.fromTextDiagram(
    new Map([
      ...extras,
      ["H", Gates.HalfTurns.H],
      ["X", Gates.HalfTurns.X],
      ["Z", Gates.HalfTurns.Z],
      ["S", Gates.QuarterTurns.SqrtZForward],
      ["t", Gates.Powering.XForward],
      ["•", Gates.Controls.Control],
      ["@", Gates.Displays.BlochSphereDisplay],
      ["D", Gates.Detectors.ZDetector],
      ["-", undefined],
      ["/", null],
    ]),
    diagram,
  );

/** What a run from the prefix must give: the whole circuit run afresh, as a run with no prefix does. */
const assertSameAsFresh = (stats, definition, time, seed) =>
  assertThat(
    statsDifference(
      stats,
      CircuitStats.fromCircuitAtTime(definition, time, seed),
    ),
  )
    .withInfo({ time, seed, circuit: definition.toString() })
    .isEqualTo(undefined);

suite.testUsingWebGL(
  "keptLength counts the columns before the first that moves with time",
  () => {
    // Spacers hold no gate, so they do not move with time and are part of the prefix.
    assertThat(StablePrefix.keptLength(circuit(`-H-S-t-H-`))).isEqualTo(5);
    assertThat(StablePrefix.keptLength(circuit(`HSt`))).isEqualTo(2);
    assertThat(StablePrefix.keptLength(circuit(`HtH-t`))).isEqualTo(1);
    // Nothing to keep when the first column moves, or no column does.
    assertThat(StablePrefix.keptLength(circuit(`tHSH`))).isEqualTo(0);
    assertThat(StablePrefix.keptLength(circuit(`-H-S-H-`))).isEqualTo(0);
    assertThat(StablePrefix.keptLength(CircuitDefinition.EMPTY)).isEqualTo(0);
  },
);

suite.testUsingWebGL(
  "a run from the kept prefix gives the stats of the whole circuit, at any time",
  () => {
    const definition = circuit(`-H-S-t-H-@-
                                -----•-X---`).withMinimumWireCount();
    const prefix = new StablePrefix();
    for (const time of [0, 0.125, 0.5, 0.9, 0.5]) {
      assertSameAsFresh(
        CircuitStats.fromCircuitAtTime(definition, time, "seed", prefix),
        definition,
        time,
        "seed",
      );
    }
    // What is kept is the state after the columns before the first that moves.
    const held = prefix.heldFor(definition, "seed");
    assertThat(held.length).isEqualTo(5);
    assertTrue(held.state !== undefined);
    prefix.release();
  },
);

suite.testUsingWebGL(
  "a run starts from what is kept, not from the circuit's first column",
  () => {
    const definition = circuit(`-H-S-t-@-`).withMinimumWireCount();
    const prefix = new StablePrefix();
    const first = CircuitStats.fromCircuitAtTime(
      definition,
      0.3,
      undefined,
      prefix,
    );
    assertThat(
      statsDifference(first, CircuitStats.fromCircuitAtTime(definition, 0.3)),
    ).isEqualTo(undefined);

    // Spoil the state that is kept. A run that really starts from it cannot then agree with a whole run.
    const { state } = prefix.heldFor(definition, undefined);
    Shaders.color(0, 0, 0, 0).renderTo(state);
    const spoilt = CircuitStats.fromCircuitAtTime(
      definition,
      0.3,
      undefined,
      prefix,
    );
    assertTrue(statsDifference(spoilt, first) !== undefined);
    prefix.release();
  },
);

suite.testUsingWebGL(
  "many random circuits give the same stats from the kept prefix as run whole",
  () => {
    let kept = 0;
    let notKept = 0;
    let withoutPrefix = 0;
    for (let i = 0; i < 120; i++) {
      const definition = randomCircuit(`prefix ${i}`).withMinimumWireCount();
      const seed = `seed ${i}`;
      const prefix = new StablePrefix();
      let state = undefined;
      for (const time of [0.05, 0.4, 0.4, 0.95]) {
        assertSameAsFresh(
          CircuitStats.fromCircuitAtTime(definition, time, seed, prefix),
          definition,
          time,
          seed,
        );
        // The prefix is made once, and then used again and again.
        const held = prefix.heldFor(definition, seed);
        if (held?.state !== undefined) {
          state = state ?? held.state;
          assertTrue(held.state === state);
        }
      }
      if (StablePrefix.keptLength(definition) === 0) {
        withoutPrefix++;
        assertTrue(prefix.heldFor(definition, seed) === undefined);
      } else if (state === undefined) {
        notKept++;
      } else {
        kept++;
      }
      prefix.release();
    }
    // The circuits cover both: prefixes that are kept, and circuits where there is nothing to keep or a
    // detector's random number means that nothing can be.
    assertTrue(kept >= 20, `${kept} kept`);
    assertTrue(notKept >= 3, `${notKept} not kept`);
    assertTrue(withoutPrefix >= 3, `${withoutPrefix} without a prefix`);
  },
);

suite.testUsingWebGL(
  "a prefix is kept while only the columns after it change",
  () => {
    const base = circuit(`-H-S-t-H-
                          -----•-X-`).withMinimumWireCount();
    const prefix = new StablePrefix();
    CircuitStats.fromCircuitAtTime(base, 0.2, "seed", prefix);
    const state = prefix.heldFor(base, "seed").state;

    // A gate changes after the first that moves: the same state serves the new circuit.
    const later = circuit(`-H-S-t-Z-
                           -----•-X-`).withMinimumWireCount();
    assertSameAsFresh(
      CircuitStats.fromCircuitAtTime(later, 0.7, "seed", prefix),
      later,
      0.7,
      "seed",
    );
    assertTrue(prefix.heldFor(later, "seed").state === state);

    // Anything the prefix depends on changing makes a prefix of its own: a column in it, the wires, the
    // initial values, the seed.
    const changes = [
      [
        circuit(`-H-Z-t-H-
                  -----•-X-`).withMinimumWireCount(),
        "seed",
      ],
      [
        circuit(`-H-S-t-H-
                  -----•-X-
                  -------H-`).withMinimumWireCount(),
        "seed",
      ],
      [base.withSwitchedInitialStateOn(0, "+"), "seed"],
      [base, "another seed"],
    ];
    for (const [definition, seed] of changes) {
      assertTrue(prefix.heldFor(definition, seed) === undefined);
      assertSameAsFresh(
        CircuitStats.fromCircuitAtTime(definition, 0.2, seed, prefix),
        definition,
        0.2,
        seed,
      );
      const held = prefix.heldFor(definition, seed);
      assertTrue(held !== undefined && held.state !== state);
      // The one before went back to the pool, leaving a single texture held.
      CircuitStats.fromCircuitAtTime(base, 0.2, "seed", prefix);
      assertTrue(prefix.heldFor(base, "seed") !== undefined);
    }
    prefix.release();
  },
);

suite.testUsingWebGL(
  "a prefix is let go when the circuit has nothing to keep",
  () => {
    const before = WglTexturePool.getUnReturnedTextureCount();
    const prefix = new StablePrefix();
    CircuitStats.fromCircuitAtTime(circuit(`-H-t-`), 0.2, undefined, prefix);
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(
      before + 1,
    );

    // A circuit with a moving first column, or none that moves, has no prefix.
    CircuitStats.fromCircuitAtTime(circuit(`tH-`), 0.2, undefined, prefix);
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
    CircuitStats.fromCircuitAtTime(circuit(`-H-t-`), 0.2, undefined, prefix);
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(
      before + 1,
    );
    CircuitStats.fromCircuitAtTime(circuit(`-H-S-`), 0.2, undefined, prefix);
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);

    CircuitStats.fromCircuitAtTime(circuit(`-H-t-`), 0.2, undefined, prefix);
    prefix.release();
    assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
  },
);

suite.testUsingWebGL(
  "a prefix that draws random numbers is not kept, and its circuit runs whole",
  () => {
    // The detector's outcome comes from the seeded random stream. A run that began after it would
    // start the stream afresh, and could not give the outcome the whole run does.
    const drawing = circuit(`-H-D-H-t-
                             -H-•-X---`);
    const prefix = new StablePrefix();
    for (const seed of ["one", "two", "three"]) {
      for (const time of [0.1, 0.6]) {
        assertSameAsFresh(
          CircuitStats.fromCircuitAtTime(drawing, time, seed, prefix),
          drawing,
          time,
          seed,
        );
      }
      const held = prefix.heldFor(drawing.withMinimumWireCount(), seed);
      assertTrue(held !== undefined && held.state === undefined);
    }

    // After the first that moves it is another matter: the random stream is where it was.
    const drawingLater = circuit(`-H-t-D-H-
                                  -H---•-X-`);
    for (const time of [0.1, 0.6, 0.6]) {
      assertSameAsFresh(
        CircuitStats.fromCircuitAtTime(drawingLater, time, "later", prefix),
        drawingLater,
        time,
        "later",
      );
    }
    assertTrue(
      prefix.heldFor(drawingLater.withMinimumWireCount(), "later")?.state !==
        undefined,
    );
    prefix.release();
  },
);

suite.testUsingWebGL(
  "a run is the same without a seed, as long as nothing draws random numbers",
  () => {
    const definition = circuit(`-H-S-t-@-`).withMinimumWireCount();
    const prefix = new StablePrefix();
    for (const time of [0.1, 0.5]) {
      assertSameAsFresh(
        CircuitStats.fromCircuitAtTime(definition, time, undefined, prefix),
        definition,
        time,
        undefined,
      );
    }
    assertTrue(prefix.heldFor(definition, undefined).state !== undefined);
    // A seed is part of what the prefix is for.
    assertTrue(prefix.heldFor(definition, "seeded") === undefined);
    prefix.release();
  },
);

suite.testUsingWebGL(
  "the stats of the columns in the prefix are kept with it",
  () => {
    const definition = new CircuitDefinition(
      2,
      [
        Gates.HalfTurns.H,
        Gates.Displays.ChanceDisplay,
        Gates.PostSelectionGates.PostSelectOn,
        Gates.Displays.BlochSphereDisplay,
        Gates.Powering.YForward,
        Gates.Displays.ChanceDisplay,
      ].map(
        (gate, col) =>
          new GateColumn([gate, col === 0 ? Gates.HalfTurns.H : undefined]),
      ),
    ).withMinimumWireCount();
    const prefix = new StablePrefix();
    for (const time of [0.3, 0.6]) {
      assertSameAsFresh(
        CircuitStats.fromCircuitAtTime(definition, time, "displays", prefix),
        definition,
        time,
        "displays",
      );
    }
    assertThat(prefix.heldFor(definition, "displays").length).isEqualTo(4);
    prefix.release();
  },
);

suite.test("a prefix does not outlive a lost context", async () => {
  const context = initializedWglContext();
  const lose = context.gl.getExtension("WEBGL_lose_context");
  if (lose === null) {
    assertThat(undefined);
    return;
  }
  const definition = circuit(`-H-S-t-@-
                                -----•-X-`).withMinimumWireCount();
  const prefix = new StablePrefix();
  const before = WglTexturePool.getUnReturnedTextureCount();
  CircuitStats.fromCircuitAtTime(definition, 0.2, "seed", prefix);
  const state = prefix.heldFor(definition, "seed").state;

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

  // The texture died with the context, so the prefix is gone and the run makes another.
  assertTrue(prefix.heldFor(definition, "seed") === undefined);
  assertSameAsFresh(
    CircuitStats.fromCircuitAtTime(definition, 0.2, "seed", prefix),
    definition,
    0.2,
    "seed",
  );
  const remade = prefix.heldFor(definition, "seed");
  assertTrue(remade !== undefined && remade.state !== state);
  assertSameAsFresh(
    CircuitStats.fromCircuitAtTime(definition, 0.7, "seed", prefix),
    definition,
    0.7,
    "seed",
  );
  prefix.release();
  assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);
  assertFalse(context.gl.isContextLost());
});
