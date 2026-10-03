import {Suite, assertThat, assertTrue} from "../../TestUtil.js";
import {Revision} from "../../../src/base/Revision.js";

import {Playhead} from "../../../src/app/state/Playhead.js";
import {Simulator} from "../../../src/app/state/Simulator.js";
import {Recorder} from "../../../src/app/state/Recorder.js";
import {TapeStore} from "../../../src/results/tapeStore.js";
import {takeJson} from "../../../src/results/files/json.js";
import {Serializer} from "../../../src/serialization/Serializer.js";
import {CircuitDefinition} from "../../../src/circuit/model/CircuitDefinition.js";
import {operationSchedule} from '../../../src/circuit/operationColumns.js';

const suite = new Suite("Recorder");
const initial = JSON.stringify({cols: [["H"], ["ZDetector"], ["Sample1"]]});

/** A store on a database of its own, whose idle callbacks run when the test says so. */
function setup(options, circuitJson = initial) {
    const revision = Revision.startingAt(circuitJson);
    const playhead = new Playhead(revision.latestActiveCommit().map(s =>
        operationSchedule(Serializer.fromJson(CircuitDefinition, JSON.parse(s)))));
    const sim = new Simulator();
    const callbacks = [];
    const name = `recorder-test-${crypto.randomUUID()}`;
    const store = new TapeStore(name, undefined, callback => callbacks.push(callback));
    // Counts how often a take reads the results it records, which is the start of encoding them.
    const encodings = {count: 0};
    const capture = () => {
        const circuit = Serializer.fromJson(CircuitDefinition, JSON.parse(revision.peekActiveCommit()));
        const result = sim.evaluate(circuit, circuit.numWires, playhead.step());
        const stats = Object.create(result.stats);
        stats.snapshotData = () => {encodings.count++; return result.stats.snapshotData();};
        return {...result, stats};
    };
    const recorder = new Recorder(revision, playhead, sim, store, capture, options);
    const idle = {scheduled: () => callbacks.length, run: () => callbacks.splice(0).forEach(callback => callback())};
    const dispose = async () => {
        (await store.db).close();
        indexedDB.deleteDatabase(name);
    };
    return {revision, playhead, sim, store, recorder, idle, encodings, dispose};
}

async function using(env, body) {
    try {await body(env);} finally {await env.dispose();}
}

const circuits = store => store.items.getState().value.map(r => r.take.circuit);

suite.test("ghost captures before an edit and undo adds no ghost", () => using(setup(), async ({revision, recorder, store, idle}) => {
    revision.commit(JSON.stringify({cols: [["X"]]}));
    idle.run();
    await store.flush();
    assertThat(store.items.getState().value.length).isEqualTo(1);
    assertThat(store.items.getState().value[0].ghost).isEqualTo(true);
    assertThat(store.items.getState().value[0].take.circuit).isEqualTo(JSON.parse(initial));
    await recorder.record();
    assertThat(store.items.getState().value[1].take.circuit).isEqualTo({cols: [["X"]]});
    revision.undo();
    idle.run();
    await store.flush();
    assertThat(store.items.getState().value.length).isEqualTo(2);
}));

suite.test("a commit returns before its ghost is encoded, and the ghost appears once the page is idle", () =>
    using(setup(), async ({revision, store, idle, encodings}) => {
        revision.commit(JSON.stringify({cols: [["X"]]}));
        assertThat(encodings.count).isEqualTo(0);
        assertThat(store.items.getState().value).isEqualTo([]);
        assertThat(idle.scheduled()).isEqualTo(1);
        idle.run();
        await store.flush();
        // Once for the playhead's results; the whole circuit's are read from the same stats object.
        assertThat(encodings.count).isEqualTo(1);
        assertThat(circuits(store)).isEqualTo([JSON.parse(initial)]);
    }));

suite.test("ghosts come out in commit order, each as the circuit stood before its edit", () =>
    using(setup(), async ({revision, store, idle}) => {
        revision.commit(JSON.stringify({cols: [["X"]]}));
        revision.commit(JSON.stringify({cols: [["X"], ["Y"]]}));
        revision.commit(JSON.stringify({cols: [["X"], ["Y"], ["Z"]]}));
        assertThat(idle.scheduled()).isEqualTo(1);
        idle.run();
        await store.flush();
        assertThat(circuits(store)).isEqualTo([JSON.parse(initial), {cols: [["X"]]}, {cols: [["X"], ["Y"]]}]);
        const recorded = store.items.getState().value.map(r => r.take.recorded);
        assertThat([...recorded].sort()).isEqualTo(recorded);
    }));

suite.test("recording writes the ghosts that are waiting first", () =>
    using(setup(), async ({revision, recorder, store, idle, encodings}) => {
        revision.commit(JSON.stringify({cols: [["X"]]}));
        assertThat(encodings.count).isEqualTo(0);
        await recorder.record();
        assertThat(store.items.getState().value.map(r => r.ghost)).isEqualTo([true, false]);
        assertThat(circuits(store)).isEqualTo([JSON.parse(initial), {cols: [["X"]]}]);
        idle.run();
        await store.flush();
        assertThat(store.items.getState().value.length).isEqualTo(2);
    }));

suite.test("importing sees the ghosts that are waiting", () =>
    using(setup(), async ({revision, recorder, store}) => {
        const [take] = await recorder.record();
        revision.commit(JSON.stringify({cols: [["X"]]}));
        await recorder.importText(takeJson(take));
        assertThat(store.items.getState().value.map(r => r.ghost)).isEqualTo([false, true]);
        assertThat(store.items.getState().value[1].take.circuit).isEqualTo(JSON.parse(initial));
    }));

suite.test("whole run is fixed-phase, atomic and cancellable", () => using(setup(), async ({recorder, store}) => {
    await recorder.recordRun();
    const takes = store.items.getState().value.map(r => r.take);
    assertThat(takes.map(t => t.step)).isEqualTo([0,1,2,3]);
    assertThat(new Set(takes.map(t => t.phase)).size).isEqualTo(1);
    assertThat(new Set(takes.map(t => t.seed)).size).isEqualTo(1);
    const pending = recorder.recordRun();
    recorder.cancel();
    let cancelled = false;
    try {await pending;} catch {cancelled = true;}
    assertTrue(cancelled);
    assertThat(store.items.getState().value.length).isEqualTo(4);
}));

suite.test("a whole run of a spinning circuit records every step at one phase", () =>
    // The animation cycle runs on the real clock here; the recording must hold it still between steps.
    using(setup(undefined, JSON.stringify({cols: [["X^t"], ["H"]]})), async ({recorder, store, sim}) => {
        await recorder.recordRun();
        const takes = store.items.getState().value.map(r => r.take);
        assertThat(takes.map(t => t.step)).isEqualTo([0, 1, 2]);
        assertThat(new Set(takes.map(t => t.phase)).size).isEqualTo(1);
        assertTrue(sim.clockRunning());
    }));

suite.test("restore retains saved outcomes without creating a ghost", () => {
    let restored;
    const env = setup({onRestore: () => {
        assertTrue(env.recorder.restoring);
        restored = env.sim.completed.getState().value;
    }});
    return using(env, async ({revision, recorder, store, playhead, sim, idle}) => {
        playhead.end();
        const [take] = await recorder.record();
        revision.commit(JSON.stringify({cols: [["X"]]}));
        const count = store.items.getState().value.length;
        recorder.restore(take);
        assertThat(restored).isEqualTo(sim.completed.getState().value);
        assertTrue(!recorder.restoring);
        assertThat(sim.completed.getState().value.stats.sampleOutcomes).isEqualTo(take.result.samples);
        assertThat(sim.seed).isEqualTo(take.seed);
        assertThat(playhead.step()).isEqualTo(3);
        // The edit's ghost is still waiting, and the restore added none of its own.
        assertThat(store.items.getState().value.length).isEqualTo(count);
        idle.run();
        await store.flush();
        assertThat(store.items.getState().value.length).isEqualTo(count + 1);
        revision.undo();
        assertThat(JSON.parse(revision.peekActiveCommit())).isEqualTo({cols: [["X"]]});
    });
});
