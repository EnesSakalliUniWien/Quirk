import {createValueStore} from '../../../src/base/valueStore.js';
import {Suite, assertThat, assertTrue} from "../../TestUtil.js";
import {Revision} from "../../../src/base/Revision.js";

import {Playhead} from "../../../src/app/state/Playhead.js";
import {Simulator} from "../../../src/app/state/Simulator.js";
import {Recorder} from "../../../src/app/state/Recorder.js";
import {Serializer} from "../../../src/serialization/Serializer.js";
import {CircuitDefinition} from "../../../src/circuit/model/CircuitDefinition.js";
import {operationSchedule} from '../../../src/circuit/operationColumns.js';
import {createMotionSettings} from '../../../src/state/motionSettings.js';
import {measuredCounts} from '../../../src/results/take/snapshot.js';
import {takeJson} from '../../../src/results/files/json.js';

const suite = new Suite("Recorder");
const initial = JSON.stringify({cols: [["H"], ["ZDetector"], ["Sample1"]]});
/** Stands in for the clock's every(), so a test takes the recording's samples by hand. */
function fakeEvery() {
    const timers = [];
    return {
        every: (millis, callback) => {
            const timer = {millis, callback, stopped: false};
            timers.push(timer);
            return () => {timer.stopped = true;};
        },
        live: () => timers.filter(t => !t.stopped),
        tick: () => timers.filter(t => !t.stopped).forEach(t => t.callback()),
    };
}

const settled = () => new Promise(resolve => setTimeout(resolve, 0));

/** A take of the recorder's circuit, made without saving it. */
const createTakeFrom = recorder => recorder.makeTake();

function setup(options, circuitJson = initial) {
    const revision = Revision.startingAt(circuitJson);
    const playhead = new Playhead(revision.latestActiveCommit().map(s =>
        operationSchedule(Serializer.fromJson(CircuitDefinition, JSON.parse(s)))));
    const sim = new Simulator();
    const store = {items: createValueStore([]), write: async (takes, options = {}) => {
        store.items.setState({value: [...store.items.getState().value, ...takes.map(take => ({id: take.id, take, ghost: options.ghost === true}))]});
    }};
    const capture = () => {
        const circuit = Serializer.fromJson(CircuitDefinition, JSON.parse(revision.peekActiveCommit()));
        return sim.evaluate(circuit, circuit.numWires, playhead.step());
    };
    const settings = createMotionSettings(undefined);
    const timers = fakeEvery();
    const recorder = new Recorder(revision, playhead, sim, store, capture, {settings, every: timers.every, ...options});
    return {revision, playhead, sim, store, recorder, settings, timers};
}

suite.test("nothing records by itself: an edit, an undo and a restored take add no take", async () => {
    const {revision, recorder, store, timers} = setup();
    revision.commit(JSON.stringify({cols: [["X"]]}));
    revision.undo();
    revision.redo();
    assertThat(store.items.getState().value.length).isEqualTo(0);
    assertThat(timers.live().length).isEqualTo(0);
    const [take] = await recorder.record();
    recorder.restore(take);
    assertThat(store.items.getState().value.length).isEqualTo(1);
});

suite.test("ghosts, once turned on, capture before an edit, and undo and an example add none", async () => {
    const {revision, recorder, store} = setup();
    recorder.ghostsEnabled.setState({value: true});
    revision.commit(JSON.stringify({cols: [["X"]]}));
    assertThat(store.items.getState().value.length).isEqualTo(1);
    assertThat(store.items.getState().value[0].take.circuit).isEqualTo(JSON.parse(initial));
    await recorder.record();
    assertThat(store.items.getState().value[1].take.circuit).isEqualTo({cols: [["X"]]});
    revision.undo();
    assertThat(store.items.getState().value.length).isEqualTo(2);
    recorder.withoutGhosts(() => revision.commit(JSON.stringify({cols: [["H"], ["H"]]})));
    assertThat(store.items.getState().value.length).isEqualTo(2);
    assertTrue(!recorder.suppressGhost);
});

suite.test("every take measures its state, as many shots as the settings say", async () => {
    const {recorder, settings, playhead} = setup();
    settings.getState().set("shots", 300);
    playhead.end();
    const [take] = await recorder.record();
    assertThat(take.measurement.shots).isEqualTo(300);
    assertThat(take.measurement.counts.reduce((sum, [, count]) => sum + count, 0)).isEqualTo(300);
    assertThat(take.measurement.counts).isEqualTo(measuredCounts(take.result.amplitudes, 300, take.measurement.seed));
    // H then a Z detector: the detector collapses the qubit, so all shots agree.
    assertThat(take.measurement.counts.length).isEqualTo(1);
    await recorder.recordRun();
    const run = recorder.store.items.getState().value.slice(1).map(r => r.take);
    assertTrue(run.every(t => t.measurement.shots === 300));
});

suite.test("a recording starts and stops only when asked, and samples at the set rate", async () => {
    const {recorder, store, settings, timers} = setup();
    settings.getState().set("sampleRateHz", 4);
    recorder.start();
    assertTrue(recorder.recording.getState().value);
    assertThat(timers.live().map(t => t.millis)).isEqualTo([250]);
    await settled();
    timers.tick();
    await settled();
    timers.tick();
    await settled();
    assertThat(store.items.getState().value.length).isEqualTo(3);
    assertThat(recorder.samples.getState().value).isEqualTo(3);
    // A new rate applies to the recording under way.
    settings.getState().set("sampleRateHz", 0.5);
    assertThat(timers.live().map(t => t.millis)).isEqualTo([2000]);
    // A whole run waits for the recording to stop.
    await recorder.recordRun();
    assertThat(store.items.getState().value.length).isEqualTo(3);
    recorder.stop();
    assertTrue(!recorder.recording.getState().value);
    assertThat(timers.live().length).isEqualTo(0);
    timers.tick();
    await settled();
    assertThat(store.items.getState().value.length).isEqualTo(3);
});

suite.test("a sample still being written drops the next rather than queueing it", async () => {
    const {recorder, store, timers} = setup();
    let release;
    const write = store.write;
    store.write = (takes, options) => new Promise(resolve => {release = () => resolve(write(takes, options));});
    recorder.start();
    timers.tick();
    timers.tick();
    release();
    await settled();
    assertThat(store.items.getState().value.length).isEqualTo(1);
    recorder.stop();
});

suite.test("a failed write ends the recording and says why", async () => {
    const {recorder, store, timers} = setup();
    store.write = async () => {throw new Error("Tape is full.");};
    recorder.start();
    await settled();
    assertTrue(!recorder.recording.getState().value);
    assertThat(recorder.recordingError.getState().value).isEqualTo("Tape is full.");
    assertThat(timers.live().length).isEqualTo(0);
});

suite.test("stopping while a sample is written, then starting again, samples at once and counts only the new recording", async () => {
    const {recorder, store, timers} = setup();
    const releases = [];
    const write = store.write;
    store.write = (takes, options) => new Promise((resolve, reject) => {
        releases.push({resolve: () => resolve(write(takes, options)), reject});
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
});

suite.test("restoring a take stops a recording", async () => {
    const {recorder, timers} = setup();
    const [take] = await recorder.record();
    recorder.start();
    await settled();
    recorder.restore(take);
    assertTrue(!recorder.recording.getState().value);
    assertThat(timers.live().length).isEqualTo(0);
});

suite.test("takes made while another is still being written get their own numbers", async () => {
    const {recorder, store} = setup();
    let release;
    const write = store.write;
    store.write = (takes, options) => new Promise(resolve => {release = () => resolve(write(takes, options));});
    const first = recorder.record();
    const second = recorder.makeTake();
    assertThat(second.name).isEqualTo("take 2");
    release();
    await first;
});

suite.test("a restore that fails part way takes its commit back", () => {
    const {recorder, revision, sim, store} = setup(undefined, JSON.stringify({cols: [["X"]]}));
    const take = createTakeFrom(setup().recorder);
    const before = revision.peekActiveCommit();
    sim.restore = () => {throw new Error("could not restore");};
    let failed = false;
    try {recorder.restore(take);} catch {failed = true;}
    assertTrue(failed);
    assertThat(revision.peekActiveCommit()).isEqualTo(before);
    assertTrue(!recorder.restoring && !recorder.suppressGhost);
    assertThat(store.items.getState().value.length).isEqualTo(0);
});

suite.test("a take from a link is left unsaved when another address is opened, and keeping nothing says so", async () => {
    const source = setup();
    const take = createTakeFrom(source.recorder);
    const {recorder} = setup();
    recorder.openLink(takeJson(take));
    recorder.closeLink();
    assertThat(recorder.linked.getState().value).isEqualTo(undefined);
    let refused = false;
    try {await recorder.keepLinked();} catch {refused = true;}
    assertTrue(refused);
});

suite.test("a linked take is restored without being saved, until it is kept", async () => {
    const source = setup();
    source.playhead.end();
    const [take] = await source.recorder.record();
    const {recorder, store, revision} = setup(undefined, JSON.stringify({cols: [["X"]]}));
    store.ready = Promise.resolve();
    recorder.openLink(takeJson(take));
    assertThat(JSON.parse(revision.peekActiveCommit())).isEqualTo(take.circuit);
    assertThat(recorder.linked.getState().value).isEqualTo(take);
    assertThat(store.items.getState().value.length).isEqualTo(0);
    await recorder.keepLinked({...take, name: "kept"});
    assertThat(store.items.getState().value.map(r => r.take.name)).isEqualTo(["kept"]);
    assertThat(recorder.linked.getState().value).isEqualTo(undefined);
});

suite.test("an import whose id is taken by a different take gets a fresh id", async () => {
    const {recorder, store} = setup();
    store.ready = Promise.resolve();
    const [take] = await recorder.record();
    const [same] = await recorder.importText(takeJson(take));
    assertThat(same.id).isEqualTo(take.id);
    const [other] = await recorder.importText(takeJson({...take, name: "other"}));
    assertTrue(other.id !== take.id);
});

suite.test("whole run is fixed-phase, atomic and cancellable", async () => {
    const {recorder, store} = setup();
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
});

suite.test("a whole run of a spinning circuit records every step at one phase", async () => {
    // The animation cycle runs on the real clock here; the recording must hold it still between steps.
    const {recorder, store, sim} = setup(undefined, JSON.stringify({cols: [["X^t"], ["H"]]}));
    await recorder.recordRun();
    const takes = store.items.getState().value.map(r => r.take);
    assertThat(takes.map(t => t.step)).isEqualTo([0, 1, 2]);
    assertThat(new Set(takes.map(t => t.phase)).size).isEqualTo(1);
    assertTrue(sim.clockRunning());
});

suite.test("restore retains saved outcomes without creating a ghost", async () => {
    let restored;
    const {revision, recorder, store, playhead, sim} = setup({onRestore: () => {
        assertTrue(recorder.restoring);
        restored = sim.completed.getState().value;
    }});
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
    assertThat(store.items.getState().value.length).isEqualTo(count);
    revision.undo();
    assertThat(JSON.parse(revision.peekActiveCommit())).isEqualTo({cols: [["X"]]});
});
