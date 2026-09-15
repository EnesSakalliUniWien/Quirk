import {createValueStore} from '../../../src/base/valueStore.js';
import {Suite, assertThat, assertTrue} from "../../TestUtil.js";
import {Revision} from "../../../src/base/Revision.js";

import {Playhead} from "../../../src/app/state/Playhead.js";
import {Simulator} from "../../../src/app/state/Simulator.js";
import {Recorder} from "../../../src/app/state/Recorder.js";
import {Serializer} from "../../../src/serialization/Serializer.js";
import {CircuitDefinition} from "../../../src/circuit/model/CircuitDefinition.js";
import {operationSchedule} from '../../../src/circuit/operationColumns.js';

const suite = new Suite("Recorder");
const initial = JSON.stringify({cols: [["H"], ["ZDetector"], ["Sample1"]]});
function setup(options) {
    const revision = Revision.startingAt(initial);
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
    const recorder = new Recorder(revision, playhead, sim, store, capture, options);
    return {revision, playhead, sim, store, recorder};
}

suite.test("ghost captures before an edit and undo adds no ghost", async () => {
    const {revision, recorder, store} = setup();
    revision.commit(JSON.stringify({cols: [["X"]]}));
    assertThat(store.items.getState().value.length).isEqualTo(1);
    assertThat(store.items.getState().value[0].take.circuit).isEqualTo(JSON.parse(initial));
    await recorder.record();
    assertThat(store.items.getState().value[1].take.circuit).isEqualTo({cols: [["X"]]});
    revision.undo();
    assertThat(store.items.getState().value.length).isEqualTo(2);
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
