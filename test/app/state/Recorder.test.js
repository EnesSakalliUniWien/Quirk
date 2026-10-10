import { createValueStore } from "../../../src/base/valueStore.js";
import { Suite, assertThat, assertTrue } from "../../TestUtil.js";
import { Revision } from "../../../src/base/Revision.js";

import { Playhead } from "../../../src/app/state/Playhead.js";
import { Simulator } from "../../../src/app/state/Simulator.js";
import { Recorder } from "../../../src/app/state/Recorder.js";
import { TapeStore } from "../../../src/results/tapeStore.js";
import { takeJson } from "../../../src/results/files/json.js";
import { Serializer } from "../../../src/serialization/Serializer.js";
import { CircuitDefinition } from "../../../src/circuit/model/CircuitDefinition.js";
import { operationSchedule } from "../../../src/circuit/operationColumns.js";
import { createMotionSettings } from "../../../src/state/motionSettings.js";
import { measuredCounts } from "../../../src/results/take/snapshot.js";

const suite = new Suite("Recorder");
const initial = JSON.stringify({ cols: [["H"], ["ZDetector"], ["Sample1"]] });

/** Stands in for the clock's every(), so a test takes the recording's samples by hand. */
function fakeEvery() {
  const timers = [];
  return {
    every: (millis, callback) => {
      const timer = { millis, callback, stopped: false };
      timers.push(timer);
      return () => {
        timer.stopped = true;
      };
    },
    live: () => timers.filter((t) => !t.stopped),
    tick: () => timers.filter((t) => !t.stopped).forEach((t) => t.callback()),
  };
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A take of the recorder's circuit, made without saving it. */
const createTakeFrom = (recorder) => recorder.makeTake();

/** A store on a database of its own, whose idle callbacks run when the test says so. */
function setup(options, circuitJson = initial) {
  const revision = Revision.startingAt(circuitJson);
  const playhead = new Playhead(
    revision
      .latestActiveCommit()
      .map((s) =>
        operationSchedule(
          Serializer.fromJson(CircuitDefinition, JSON.parse(s)),
        ),
      ),
  );
  const sim = new Simulator();
  const callbacks = [];
  const name = `recorder-test-${crypto.randomUUID()}`;
  const store = new TapeStore(name, undefined, (callback) =>
    callbacks.push(callback),
  );
  // Counts how often a take reads the results it records, which is the start of encoding them.
  const encodings = { count: 0 };
  const capture = () => {
    const circuit = Serializer.fromJson(
      CircuitDefinition,
      JSON.parse(revision.peekActiveCommit()),
    );
    const result = sim.evaluate(circuit, circuit.numWires, playhead.step());
    const stats = Object.create(result.stats);
    stats.snapshotData = () => {
      encodings.count++;
      return result.stats.snapshotData();
    };
    return { ...result, stats };
  };
  const settings = createMotionSettings(undefined);
  const timers = fakeEvery();
  const recorder = new Recorder(revision, playhead, sim, store, capture, {
    settings,
    every: timers.every,
    ...options,
  });
  const idle = {
    scheduled: () => callbacks.length,
    run: () => callbacks.splice(0).forEach((callback) => callback()),
  };
  const dispose = async () => {
    (await store.db).close();
    indexedDB.deleteDatabase(name);
  };
  return {
    revision,
    playhead,
    sim,
    store,
    recorder,
    settings,
    timers,
    idle,
    encodings,
    dispose,
  };
}

async function using(env, body) {
  try {
    await body(env);
  } finally {
    await env.dispose();
  }
}

/** Ghosts are the user's to turn on; the tests of how they are kept turn them on first. */
function withGhosts(env) {
  env.recorder.ghostsEnabled.setState({ value: true });
  return env;
}

/**
 * The recorder over a store held in memory, whose writes land at once: a recording's samples are
 * timed against the recorder alone, not against IndexedDB.
 */
function memorySetup(options, circuitJson = initial) {
  const revision = Revision.startingAt(circuitJson);
  const playhead = new Playhead(
    revision
      .latestActiveCommit()
      .map((s) =>
        operationSchedule(
          Serializer.fromJson(CircuitDefinition, JSON.parse(s)),
        ),
      ),
  );
  const sim = new Simulator();
  const store = {
    items: createValueStore([]),
    write: async (takes, options = {}) => {
      store.items.setState({
        value: [
          ...store.items.getState().value,
          ...takes.map((take) => ({
            id: take.id,
            take,
            ghost: options.ghost === true,
          })),
        ],
      });
    },
    deferGhost: (plan) => store.write([plan()], { ghost: true }),
    flush: async () => {},
  };
  const capture = () => {
    const circuit = Serializer.fromJson(
      CircuitDefinition,
      JSON.parse(revision.peekActiveCommit()),
    );
    return sim.evaluate(circuit, circuit.numWires, playhead.step());
  };
  const settings = createMotionSettings(undefined);
  const timers = fakeEvery();
  const recorder = new Recorder(revision, playhead, sim, store, capture, {
    settings,
    every: timers.every,
    ...options,
  });
  return { revision, playhead, sim, store, recorder, settings, timers };
}

const circuits = (store) =>
  store.items.getState().value.map((r) => r.take.circuit);

suite.test("ghost captures before an edit and undo adds no ghost", () =>
  using(withGhosts(setup()), async ({ revision, recorder, store, idle }) => {
    revision.commit(JSON.stringify({ cols: [["X"]] }));
    idle.run();
    await store.flush();
    assertThat(store.items.getState().value.length).isEqualTo(1);
    assertThat(store.items.getState().value[0].ghost).isEqualTo(true);
    assertThat(store.items.getState().value[0].take.circuit).isEqualTo(
      JSON.parse(initial),
    );
    await recorder.record();
    assertThat(store.items.getState().value[1].take.circuit).isEqualTo({
      cols: [["X"]],
    });
    revision.undo();
    idle.run();
    await store.flush();
    assertThat(store.items.getState().value.length).isEqualTo(2);
  }),
);

suite.test(
  "a commit returns before its ghost is encoded, and the ghost appears once the page is idle",
  () =>
    using(withGhosts(setup()), async ({ revision, store, idle, encodings }) => {
      revision.commit(JSON.stringify({ cols: [["X"]] }));
      assertThat(encodings.count).isEqualTo(0);
      assertThat(store.items.getState().value).isEqualTo([]);
      assertThat(idle.scheduled()).isEqualTo(1);
      idle.run();
      await store.flush();
      // Once for the playhead's results; the whole circuit's are read from the same stats object.
      assertThat(encodings.count).isEqualTo(1);
      assertThat(circuits(store)).isEqualTo([JSON.parse(initial)]);
    }),
);

suite.test(
  "ghosts come out in commit order, each as the circuit stood before its edit",
  () =>
    using(withGhosts(setup()), async ({ revision, store, idle }) => {
      revision.commit(JSON.stringify({ cols: [["X"]] }));
      revision.commit(JSON.stringify({ cols: [["X"], ["Y"]] }));
      revision.commit(JSON.stringify({ cols: [["X"], ["Y"], ["Z"]] }));
      assertThat(idle.scheduled()).isEqualTo(1);
      idle.run();
      await store.flush();
      assertThat(circuits(store)).isEqualTo([
        JSON.parse(initial),
        { cols: [["X"]] },
        { cols: [["X"], ["Y"]] },
      ]);
      const recorded = store.items.getState().value.map((r) => r.take.recorded);
      assertThat([...recorded].sort()).isEqualTo(recorded);
    }),
);

suite.test("recording writes the ghosts that are waiting first", () =>
  using(
    withGhosts(setup()),
    async ({ revision, recorder, store, idle, encodings }) => {
      revision.commit(JSON.stringify({ cols: [["X"]] }));
      assertThat(encodings.count).isEqualTo(0);
      await recorder.record();
      assertThat(store.items.getState().value.map((r) => r.ghost)).isEqualTo([
        true,
        false,
      ]);
      assertThat(circuits(store)).isEqualTo([
        JSON.parse(initial),
        { cols: [["X"]] },
      ]);
      idle.run();
      await store.flush();
      assertThat(store.items.getState().value.length).isEqualTo(2);
    },
  ),
);

suite.test("importing sees the ghosts that are waiting", () =>
  using(withGhosts(setup()), async ({ revision, recorder, store }) => {
    const [take] = await recorder.record();
    revision.commit(JSON.stringify({ cols: [["X"]] }));
    await recorder.importText(takeJson(take));
    assertThat(store.items.getState().value.map((r) => r.ghost)).isEqualTo([
      false,
      true,
    ]);
    assertThat(store.items.getState().value[1].take.circuit).isEqualTo(
      JSON.parse(initial),
    );
  }),
);

suite.test("whole run is fixed-phase, atomic and cancellable", () =>
  using(setup(), async ({ recorder, store }) => {
    await recorder.recordRun();
    const takes = store.items.getState().value.map((r) => r.take);
    assertThat(takes.map((t) => t.step)).isEqualTo([0, 1, 2, 3]);
    assertThat(new Set(takes.map((t) => t.phase)).size).isEqualTo(1);
    assertThat(new Set(takes.map((t) => t.seed)).size).isEqualTo(1);
    const pending = recorder.recordRun();
    recorder.cancel();
    let cancelled = false;
    try {
      await pending;
    } catch {
      cancelled = true;
    }
    assertTrue(cancelled);
    assertThat(store.items.getState().value.length).isEqualTo(4);
  }),
);

suite.test(
  "a whole run of a spinning circuit records every step at one phase",
  () =>
    // The animation cycle runs on the real clock here; the recording must hold it still between steps.
    using(
      setup(undefined, JSON.stringify({ cols: [["X^t"], ["H"]] })),
      async ({ recorder, store, sim }) => {
        await recorder.recordRun();
        const takes = store.items.getState().value.map((r) => r.take);
        assertThat(takes.map((t) => t.step)).isEqualTo([0, 1, 2]);
        assertThat(new Set(takes.map((t) => t.phase)).size).isEqualTo(1);
        assertTrue(sim.clockRunning());
      },
    ),
);

suite.test("restore retains saved outcomes without creating a ghost", () => {
  let restored;
  const env = setup({
    onRestore: () => {
      assertTrue(env.recorder.restoring);
      restored = env.sim.completed.getState().value;
    },
  });
  return using(
    withGhosts(env),
    async ({ revision, recorder, store, playhead, sim, idle }) => {
      playhead.end();
      const [take] = await recorder.record();
      revision.commit(JSON.stringify({ cols: [["X"]] }));
      const count = store.items.getState().value.length;
      recorder.restore(take);
      assertThat(restored).isEqualTo(sim.completed.getState().value);
      assertTrue(!recorder.restoring);
      assertThat(sim.completed.getState().value.stats.sampleOutcomes).isEqualTo(
        take.result.samples,
      );
      assertThat(sim.seed).isEqualTo(take.seed);
      assertThat(playhead.step()).isEqualTo(3);
      // The edit's ghost is still waiting, and the restore added none of its own.
      assertThat(store.items.getState().value.length).isEqualTo(count);
      idle.run();
      await store.flush();
      assertThat(store.items.getState().value.length).isEqualTo(count + 1);
      revision.undo();
      assertThat(JSON.parse(revision.peekActiveCommit())).isEqualTo({
        cols: [["X"]],
      });
    },
  );
});

suite.test(
  "nothing records by itself: an edit, an undo and a restored take add no take",
  async () => {
    const { revision, recorder, store, timers } = memorySetup();
    revision.commit(JSON.stringify({ cols: [["X"]] }));
    revision.undo();
    revision.redo();
    assertThat(store.items.getState().value.length).isEqualTo(0);
    assertThat(timers.live().length).isEqualTo(0);
    const [take] = await recorder.record();
    recorder.restore(take);
    assertThat(store.items.getState().value.length).isEqualTo(1);
  },
);

suite.test(
  "ghosts, once turned on, capture before an edit, and undo and an example add none",
  async () => {
    const { revision, recorder, store } = memorySetup();
    recorder.ghostsEnabled.setState({ value: true });
    revision.commit(JSON.stringify({ cols: [["X"]] }));
    assertThat(store.items.getState().value.length).isEqualTo(1);
    assertThat(store.items.getState().value[0].take.circuit).isEqualTo(
      JSON.parse(initial),
    );
    await recorder.record();
    assertThat(store.items.getState().value[1].take.circuit).isEqualTo({
      cols: [["X"]],
    });
    revision.undo();
    assertThat(store.items.getState().value.length).isEqualTo(2);
    recorder.withoutGhosts(() =>
      revision.commit(JSON.stringify({ cols: [["H"], ["H"]] })),
    );
    assertThat(store.items.getState().value.length).isEqualTo(2);
    assertTrue(!recorder.suppressGhost);
  },
);

suite.test(
  "every take measures its state, as many shots as the settings say",
  async () => {
    const { recorder, settings, playhead } = memorySetup();
    settings.getState().set("shots", 300);
    playhead.end();
    const [take] = await recorder.record();
    assertThat(take.measurement.shots).isEqualTo(300);
    assertThat(
      take.measurement.counts.reduce((sum, [, count]) => sum + count, 0),
    ).isEqualTo(300);
    assertThat(take.measurement.counts).isEqualTo(
      measuredCounts(take.result.amplitudes, 300, take.measurement.seed),
    );
    // H then a Z detector: the detector collapses the qubit, so all shots agree.
    assertThat(take.measurement.counts.length).isEqualTo(1);
    await recorder.recordRun();
    const run = recorder.store.items
      .getState()
      .value.slice(1)
      .map((r) => r.take);
    assertTrue(run.every((t) => t.measurement.shots === 300));
  },
);

suite.test(
  "a recording starts and stops only when asked, and samples at the set rate",
  async () => {
    const { recorder, store, settings, timers } = memorySetup();
    settings.getState().set("sampleRateHz", 4);
    recorder.start();
    assertTrue(recorder.recording.getState().value);
    assertThat(timers.live().map((t) => t.millis)).isEqualTo([250]);
    await settled();
    timers.tick();
    await settled();
    timers.tick();
    await settled();
    assertThat(store.items.getState().value.length).isEqualTo(3);
    assertThat(recorder.samples.getState().value).isEqualTo(3);
    // A new rate applies to the recording under way.
    settings.getState().set("sampleRateHz", 0.5);
    assertThat(timers.live().map((t) => t.millis)).isEqualTo([2000]);
    // A whole run waits for the recording to stop.
    await recorder.recordRun();
    assertThat(store.items.getState().value.length).isEqualTo(3);
    recorder.stop();
    assertTrue(!recorder.recording.getState().value);
    assertThat(timers.live().length).isEqualTo(0);
    timers.tick();
    await settled();
    assertThat(store.items.getState().value.length).isEqualTo(3);
  },
);

suite.test(
  "a sample still being written drops the next rather than queueing it",
  async () => {
    const { recorder, store, timers } = memorySetup();
    let release;
    const write = store.write;
    store.write = (takes, options) =>
      new Promise((resolve) => {
        release = () => resolve(write(takes, options));
      });
    recorder.start();
    timers.tick();
    timers.tick();
    release();
    await settled();
    assertThat(store.items.getState().value.length).isEqualTo(1);
    recorder.stop();
  },
);

suite.test("a failed write ends the recording and says why", async () => {
  const { recorder, store, timers } = memorySetup();
  store.write = async () => {
    throw new Error("Tape is full.");
  };
  recorder.start();
  await settled();
  assertTrue(!recorder.recording.getState().value);
  assertThat(recorder.recordingError.getState().value).isEqualTo(
    "Tape is full.",
  );
  assertThat(timers.live().length).isEqualTo(0);
});

suite.test(
  "stopping while a sample is written, then starting again, samples at once and counts only the new recording",
  async () => {
    const { recorder, store, timers } = memorySetup();
    const releases = [];
    const write = store.write;
    store.write = (takes, options) =>
      new Promise((resolve, reject) => {
        releases.push({
          resolve: () => resolve(write(takes, options)),
          reject,
        });
      });
    recorder.start();
    recorder.stop();
    recorder.start();
    // The new recording's first sample does not wait for the old one's write.
    assertThat(releases.length).isEqualTo(2);
    releases[0].reject(new Error("the old write failed"));
    await settled();
    // A failure of the old recording's write neither stops the new one nor reports on it.
    assertTrue(recorder.recording.getState().value);
    assertThat(recorder.recordingError.getState().value).isEqualTo("");
    releases[1].resolve();
    await settled();
    assertThat(recorder.samples.getState().value).isEqualTo(1);
    timers.tick();
    assertThat(releases.length).isEqualTo(3);
    recorder.stop();
  },
);

suite.test("restoring a take stops a recording", async () => {
  const { recorder, timers } = memorySetup();
  const [take] = await recorder.record();
  recorder.start();
  await settled();
  recorder.restore(take);
  assertTrue(!recorder.recording.getState().value);
  assertThat(timers.live().length).isEqualTo(0);
});

suite.test(
  "takes made while another is still being written get their own numbers",
  async () => {
    const { recorder, store } = memorySetup();
    let release;
    const write = store.write;
    store.write = (takes, options) =>
      new Promise((resolve) => {
        release = () => resolve(write(takes, options));
      });
    const first = recorder.record();
    const second = recorder.makeTake();
    assertThat(second.name).isEqualTo("snapshot 2");
    release();
    await first;
  },
);

suite.test("a restore that fails part way takes its commit back", () => {
  const { recorder, revision, sim, store } = memorySetup(
    undefined,
    JSON.stringify({ cols: [["X"]] }),
  );
  const take = createTakeFrom(memorySetup().recorder);
  const before = revision.peekActiveCommit();
  sim.restore = () => {
    throw new Error("could not restore");
  };
  let failed = false;
  try {
    recorder.restore(take);
  } catch {
    failed = true;
  }
  assertTrue(failed);
  assertThat(revision.peekActiveCommit()).isEqualTo(before);
  assertTrue(!recorder.restoring && !recorder.suppressGhost);
  assertThat(store.items.getState().value.length).isEqualTo(0);
});

suite.test(
  "a take from a link is left unsaved when another address is opened, and keeping nothing says so",
  async () => {
    const source = memorySetup();
    const take = createTakeFrom(source.recorder);
    const { recorder } = memorySetup();
    recorder.openLink(takeJson(take));
    recorder.closeLink();
    assertThat(recorder.linked.getState().value).isEqualTo(undefined);
    let refused = false;
    try {
      await recorder.keepLinked();
    } catch {
      refused = true;
    }
    assertTrue(refused);
  },
);

suite.test(
  "a linked take is restored without being saved, until it is kept",
  async () => {
    const source = memorySetup();
    source.playhead.end();
    const [take] = await source.recorder.record();
    const { recorder, store, revision } = memorySetup(
      undefined,
      JSON.stringify({ cols: [["X"]] }),
    );
    recorder.openLink(takeJson(take));
    assertThat(JSON.parse(revision.peekActiveCommit())).isEqualTo(take.circuit);
    assertThat(recorder.linked.getState().value).isEqualTo(take);
    assertThat(store.items.getState().value.length).isEqualTo(0);
    await recorder.keepLinked({ ...take, name: "kept" });
    assertThat(store.items.getState().value.map((r) => r.take.name)).isEqualTo([
      "kept",
    ]);
    assertThat(recorder.linked.getState().value).isEqualTo(undefined);
  },
);

suite.test(
  "an import whose id is taken by a different take gets a fresh id",
  async () => {
    const { recorder } = memorySetup();
    const [take] = await recorder.record();
    const [same] = await recorder.importText(takeJson(take));
    assertThat(same.id).isEqualTo(take.id);
    const [other] = await recorder.importText(
      takeJson({ ...take, name: "other" }),
    );
    assertTrue(other.id !== take.id);
  },
);
