import {Suite, assertThat, assertTrue} from "../TestUtil.js";
import {Serializer} from "../../src/serialization/Serializer.js";
import {CircuitDefinition} from "../../src/circuit/model/CircuitDefinition.js";
import {Simulator} from "../../src/app/state/Simulator.js";
import { createTake, restoreTake } from "../../src/results/take/snapshot.js";
import { parseTakes, takeJson, album } from "../../src/results/files/json.js";
import { takeCsv } from "../../src/results/files/csv.js";
import { takeLink } from "../../src/results/files/link.js";
import {qubitReadings} from "../../src/engine/simulation/qubitMarginals.js";
import {TapeStore} from "../../src/results/tapeStore.js";
import {CircuitStats} from "../../src/engine/simulation/CircuitStats.js";

const suite = new Suite("Tape results");
const circuit = cols => Serializer.fromJson(CircuitDefinition, {cols});
const takeFor = (cols, step = cols.length) => {
    const c = circuit(cols);
    return createTake(new Simulator().evaluate(c, c.numWires, step));
};

suite.testUsingWebGL("full JSON and album round trip preserve sampled results", () => {
    const take = takeFor([["H"], ["ZDetector"], ["Sample1"], ["X"]], 3);
    const loaded = parseTakes(takeJson(take))[0];
    assertThat(loaded).isEqualTo(take);
    assertThat(parseTakes(takeJson(album([take])))).isEqualTo([take]);
    assertThat(restoreTake(loaded).stats.sampleOutcomes).isEqualTo(take.result.samples);
    assertTrue(takeCsv([take]).includes('"joint"'));
    assertTrue(takeLink(take, "https://example.org/").includes("#take="));
});

suite.test("unavailable results round trip with zero padding only beyond simulated wires", () => {
    const c = circuit([["H"]]);
    const stats = CircuitStats.withNanDataFromCircuitAtTime(c.withMinimumWireCount(), 0);
    const take = createTake({circuit: c, wireCount: 3, step: 1, phase: 0, seed: "unavailable",
        stats, fullStats: stats});
    assertThat(parseTakes(takeJson(take))[0]).isEqualTo(take);
    assertTrue(restoreTake(take).stats.finalState.hasNaN());
    assertThat(take.result.amplitudes.slice(2 * 2 ** stats.circuitDefinition.numWires)).isEqualTo(new Array(12).fill(0));
    for (const field of ["result", "fullResult"]) {
        for (const [index, value] of [[0, 0], [15, 1]]) {
            const bad = structuredClone(take);
            bad[field].amplitudes[index] = value;
            let rejected = false;
            try {parseTakes(takeJson(bad));} catch {rejected = true;}
            assertTrue(rejected);
        }
    }
});

suite.testUsingWebGL("Sample imports reject missing outcomes and inconsistent distributions", () => {
    const take = takeFor([["H"], ["Sample1"]]);
    for (const field of ["result", "fullResult"]) {
        for (const corrupt of [
            s => {s.samples = {};},
            s => {s.samples["1:0"].p = 0;},
            s => {s.samples["1:0"].i = 2;},
            s => {s.samples["1:0:extra"] = s.samples["1:0"]; delete s.samples["1:0"];},
            s => {s.custom = []; s.samples = {};},
        ]) {
            const bad = structuredClone(take);
            corrupt(bad[field]);
            let rejected = false;
            try {parseTakes(takeJson(bad));} catch {rejected = true;}
            assertTrue(rejected);
        }
    }
    // An impossible control leaves the Sample distribution unavailable, with no outcome.
    const unavailable = takeFor([["•", "Sample1"]]);
    assertThat(unavailable.result.samples).isEqualTo({});
    assertThat(parseTakes(takeJson(unavailable))[0]).isEqualTo(unavailable);
    const disabled = takeFor([["Sample2", "X"]]);
    assertThat(parseTakes(takeJson(disabled))[0]).isEqualTo(disabled);
});

suite.testUsingWebGL("imports require every enabled detector and display result", () => {
    for (const id of ["ZDetector", "Chance2", "Density2", "Amps2", "Sample2"]) {
        const take = takeFor([["H"], [id]]);
        assertThat(parseTakes(takeJson(take))[0]).isEqualTo(take);
        for (const field of ["result", "fullResult"]) {
            const bad = structuredClone(take);
            bad[field].custom = [];
            bad[field].samples = {};
            let rejected = false;
            try {parseTakes(takeJson(bad));} catch {rejected = true;}
            assertTrue(rejected);
        }
        // Disabled gates collect no custom result and must remain importable.
        if (id !== "ZDetector") {
            const disabled = takeFor([[id, "•"]]);
            assertThat(disabled.result.custom).isEqualTo([]);
            assertThat(parseTakes(takeJson(disabled))[0]).isEqualTo(disabled);
        }
    }
    // These displays read the density history instead of collecting custom payloads.
    const densitiesOnly = takeFor([["Chance"], ["Density"], ["Bloch"]]);
    assertThat(densitiesOnly.result.custom).isEqualTo([]);
    assertThat(parseTakes(takeJson(densitiesOnly))[0]).isEqualTo(densitiesOnly);
});

suite.testUsingWebGL("deferred measurement has zero coherence in Qubits", () => {
    const sim = new Simulator();
    const c = circuit([["H"], ["Measure"]]);
    const r = qubitReadings(sim.evaluate(c, 1, 2).stats, 1)[0];
    assertThat(r.bloch.x).isApproximatelyEqualTo(0);
    assertThat(r.bloch.y).isApproximatelyEqualTo(0);
    assertThat(r.bloch.z).isApproximatelyEqualTo(0);
    assertThat(r.purity).isApproximatelyEqualTo(0.5);
});

suite.testUsingWebGL("full and prefix detectors share outcomes", () => {
    const sim = new Simulator();
    const c = circuit([["H"], ["ZDetector"], ["Sample1"], ["X"]]);
    for (let i = 0; i < 12; i++) {
        sim.seed = String(i);
        const r = sim.evaluate(c, 1, 3);
        assertThat(r.stats.customStatsForSlot(1, 0)).isEqualTo(r.fullStats.customStatsForSlot(1, 0));
        assertThat(r.stats.sampleOutcomes).isEqualTo(r.fullStats.sampleOutcomes);
    }
});

suite.test("pause and resume exclude paused elapsed time", () => {
    let now = 0;
    const sim = new Simulator(() => now);
    now = 1000;
    assertThat(sim.cycleTime()).isEqualTo(0);
    sim.setPlaying(true);
    now += 250;
    sim.setPlaying(false);
    const phase = sim.cycleTime();
    now += 100000;
    assertThat(sim.cycleTime()).isEqualTo(phase);
    sim.setPlaying(true);
    assertThat(sim.cycleTime()).isEqualTo(phase);
});

suite.testUsingWebGL("sixteen qubits retain every amplitude", () => {
    const take = takeFor([[...new Array(15).fill(1), "H"]]);
    assertThat(take.result.amplitudes.length).isEqualTo(131072);
    assertThat(parseTakes(takeJson(take))[0].result.amplitudes.length).isEqualTo(131072);
});

suite.testUsingWebGL("amplitude displays and unused wires survive file restore", () => {
    const take = takeFor([["H"], ["Amps1"]]);
    const restored = restoreTake(parseTakes(takeJson(take))[0]);
    assertThat(restored.stats.customStatsForSlot(1, 0).ket.width()).isEqualTo(2);
    assertThat(qubitReadings(restored.stats, take.wires)[1].probabilityOne).isApproximatelyEqualTo(0);
    assertThat(restored.stats.finalState.height()).isEqualTo(2 ** take.wires);
});

suite.testUsingWebGL("reject malformed imports and oversized links", () => {
    const take = takeFor([["H"]]);
    for (const bad of [{...take, format: "future/2"}, {...take, step: 20},
        {...take, result: {...take.result, amplitudes: []}}, {...take, circuit: {cols: [["unknown-gate"]]}}]) {
        let failed = false;
        try {parseTakes(takeJson(bad));} catch {failed = true;}
        assertTrue(failed);
    }
    let failed = false;
    try {takeLink({...take, notes: "a".repeat(33000)}, "https://example.org");} catch {failed = true;}
    assertTrue(failed);
});

suite.test("IndexedDB admission is atomic and only evicts ghosts", async () => {
    const name = `tape-test-${crypto.randomUUID()}`;
    const store = new TapeStore(name, 100000);
    const take = takeFor([["H"]]);
    try {
        await store.ready;
        await store.write([take]);
        for (let i = 0; i < 10; i++) await store.write([{...take, id: `ghost-${i}`}], {ghost: true});
        assertThat(store.items.getState().value.filter(r => r.ghost).length).isEqualTo(8);
        assertTrue(store.items.getState().value.some(r => r.id === take.id));
        const before = store.items.getState().value;
        store.cap = 1;
        let rejected = false;
        try {await store.write([{...take, id: "too-big"}]);} catch {rejected = true;}
        assertTrue(rejected);
        await store.refresh();
        assertThat(store.items.getState().value).isEqualTo(before);
    } finally {
        (await store.db).close();
        indexedDB.deleteDatabase(name);
    }
});
