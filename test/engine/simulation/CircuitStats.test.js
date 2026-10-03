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

import {Suite, assertThat, assertThrows, assertTrue} from "../../TestUtil.js"
import {CircuitStats} from "../../../src/engine/simulation/CircuitStats.js"

import {CircuitDefinition} from "../../../src/circuit/model/CircuitDefinition.js"
import {GateColumn} from "../../../src/circuit/model/GateColumn.js"
import {Gates} from "../../../src/gates/AllGates.js"
import {Matrix} from "../../../src/engine/math/matrix/Matrix.js"
import {Serializer} from "../../../src/serialization/Serializer.js"
import {QubitMatrix} from "../../../src/engine/math/matrix/QubitMatrix.js"
import {GateBuilder} from "../../../src/circuit/model/Gate.js"
import {Shaders} from "../../../src/engine/webgl/operations/Shaders.js"
import {paddedState} from "../../../src/engine/simulation/stepAlgebra.js"
import {randomCircuit} from "./randomCircuits.js"
import {sameData} from "./statsComparison.js"
import {StablePrefix} from "../../../src/engine/simulation/StablePrefix.js"
import {WglTexturePool} from "../../../src/engine/webgl/texture/WglTexturePool.js"

const suite = new Suite("CircuitStats");

suite.testUsingWebGL("batched readback preserves single, array and empty custom statistics", () => {
    const statGate = (id, makeTextures) => new GateBuilder()
        .setSerializedId(id)
        .promiseHasNoNetEffectOnStateVector()
        .setStatTexturesMaker(makeTextures)
        .gate;
    const single = statGate("readback-single", () => Shaders.color(2, 3, 4, 5).toVec4Texture(0));
    const array = statGate("readback-array", () => [
        Shaders.color(6, 7, 8, 9).toVec4Texture(0),
        Shaders.color(10, 11, 12, 13).toVec4Texture(0)
    ]);
    const empty = statGate("readback-empty", () => []);
    const definition = new CircuitDefinition(1, [
        Gates.HalfTurns.H, single, array, empty, Gates.PostSelectionGates.PostSelectOn
    ].map(gate => new GateColumn([gate])));
    const stats = CircuitStats._fromCircuitAtTime_noFallback(definition, 0);
    assertThat(stats.customStatsForSlot(1, 0)).isEqualTo(new Float32Array([2, 3, 4, 5]));
    assertThat(stats.customStatsForSlot(2, 0)).isEqualTo([
        new Float32Array([6, 7, 8, 9]), new Float32Array([10, 11, 12, 13])
    ]);
    assertThat(stats.customStatsForSlot(3, 0)).isEqualTo([]);
    assertThat(stats.survivalRate(Infinity)).isApproximatelyEqualTo(0.5);
    assertThat(stats.finalState).isApproximatelyEqualTo(Matrix.col(0, 1));
    assertThat(stats.qubitDensityMatrix(Infinity, 0)).isApproximatelyEqualTo(Matrix.square(0, 0, 0, 1));
});

suite.test("snapshotData preserves histories without exposing their containers", () => {
    const stats = new CircuitStats(CircuitDefinition.EMPTY.withWireCount(1), 0.25,
        [0.75], [[Matrix.square(0.25, 0, 0, 0.75)]], Matrix.col(1, 0),
        new Map([["0:0", true], ["1:0", false]]));
    const data = stats.snapshotData();
    assertThat(data).isEqualTo({survival: [0.75],
        densities: [[[0.25, 0, 0, 0, 0, 0, 0.75, 0]]], custom: [["0:0", true], ["1:0", false]]});
    data.survival[0] = 0;
    data.densities[0][0][0] = 0;
    data.custom[0][1] = false;
    data.custom.pop();
    assertThat(stats.survivalRate(0)).isEqualTo(0.75);
    assertThat(stats.qubitDensityMatrix(0, 0)).isEqualTo(Matrix.square(0.25, 0, 0, 0.75));
    assertThat([...stats.customStatsEntries()]).isEqualTo([["0:0", true], ["1:0", false]]);
    const missing = CircuitStats.withNanDataFromCircuitAtTime(CircuitDefinition.EMPTY, 0).snapshotData();
    assertThat(missing).isEqualTo({survival: [1], densities: [], custom: []});
});

const circuit = (diagram, ...extras) => CircuitDefinition.fromTextDiagram(new Map([
    ...extras,
    ['X', Gates.HalfTurns.X],
    ['Y', Gates.HalfTurns.Y],
    ['Z', Gates.HalfTurns.Z],
    ['H', Gates.HalfTurns.H],
    ['•', Gates.Controls.Control],
    ['◦', Gates.Controls.AntiControl],
    ['⊕', Gates.Controls.XAntiControl],

    ['M', Gates.Special.Measurement],
    ['@', Gates.Displays.BlochSphereDisplay],
    ['!', Gates.PostSelectionGates.PostSelectOn],

    ['-', undefined],
    ['+', undefined],
    ['|', undefined],
    ['/', null]
]), diagram);

suite.testUsingWebGL("one run gives each step's state, as a run of just those columns would", () => {
    const cases = [
        // Controls, a measurement and a display.
        [circuit(`-H-•-M-@-
                  ---X-----
                  ------H--`), 0.1, undefined],
        // Post-selection: each later state is renormalized by the chance of surviving to it.
        [circuit(`-H-!-H-
                  -H-•-X-`), 0, undefined],
        // A detector draws from the seeded random stream, column by column.
        [circuit(`-H-D-H-D-
                  -H-•-X---`, ['D', Gates.Detectors.ZDetector]), 0, "detector seed"],
        // A time-dependent gate, and a wire nothing touches until the last column.
        [circuit(`-H-S---
                  -------
                  -----H-`, ['S', Gates.Powering.XForward]), 0.3, "spin seed"],
        // Columns before the time-dependent gate that post-select, display and control, to start from.
        [circuit(`-H-!-•-S-X-@-
                  -H-•-X-----•-
                  -------H-----`, ['S', Gates.Powering.XForward]), 0.7, "prefix seed"],
        // An initial value on a wire the first columns leave alone.
        [circuit(`-H-
                  ---
                  -X-`).withSwitchedInitialStateOn(1), 0, undefined],
    ];
    for (const [definition, time, seed] of cases) {
        const stats = CircuitStats.fromCircuitAtTime(definition, time, seed);
        const shown = stats.circuitDefinition;
        const wires = definition.numWires;
        const steps = Array.from({length: shown.columns.length + 1}, (_, k) => k);
        const states = stats.statesAfterSteps(steps);
        for (const k of steps) {
            const truncated = shown.withColumns(shown.columns.slice(0, k));
            const expected = paddedState(CircuitStats.fromCircuitAtTime(truncated, time, seed).finalState, wires);
            assertThat(paddedState(states[k], wires)).withInfo({diagram: Serializer.toJson(definition), k}).
                isApproximatelyEqualTo(expected, 1e-6);
        }

        // Over more wires than the circuit has, each state is the same numbers with zeros after them.
        const wider = stats.statesAfterSteps(steps, undefined, wires + 2);
        for (const k of steps) {
            assertThat(wider[k]).withInfo({k}).isEqualTo(paddedState(states[k], wires + 2));
        }

        // Started from what a prefix kept, a run applies only the columns after it and gives the same
        // states, bit for bit. A step before the prefix's end makes the run from the start.
        const prefix = new StablePrefix();
        CircuitStats.fromCircuitAtTime(definition, time, seed, prefix);
        const kept = StablePrefix.keptLength(shown);
        for (const first of new Set([0, Math.max(0, kept - 1), kept, kept + 1, steps.length - 1])) {
            const wanted = steps.filter(k => k >= first);
            const ran = stats.statesAfterSteps(wanted, prefix);
            for (const [i, k] of wanted.entries()) {
                assertThat(ran[i]).withInfo({diagram: Serializer.toJson(definition), first, k}).isEqualTo(states[k]);
            }
        }
        prefix.release();
    }
    // Steps come back in the order asked, a repeat as often as asked.
    const stats = CircuitStats.fromCircuitAtTime(circuit(`-H-X-`), 0);
    const [two, zero, again] = stats.statesAfterSteps([2, 0, 2]);
    assertThat(zero).isApproximatelyEqualTo(Matrix.col(1, 0), 1e-6);
    assertThat(two).isApproximatelyEqualTo(Matrix.col(Math.SQRT1_2, Math.SQRT1_2), 1e-6);
    assertThat(again === two).isEqualTo(true);
    assertThat(stats.statesAfterSteps([])).isEqualTo([]);
});

suite.testUsingWebGL("the states after steps start from the kept prefix when it is the circuit's and no step is before it", () => {
    const definition = circuit(`-H-•-S-X-@-
                                ---X-------`, ['S', Gates.Powering.XForward]).withMinimumWireCount();
    const count = definition.columns.length;
    const kept = StablePrefix.keptLength(definition);
    assertTrue(kept > 2 && kept < count - 2);
    const steps = Array.from({length: count + 1}, (_, k) => k);
    const stats = CircuitStats.fromCircuitAtTime(definition, 0.3, "seed");
    const full = stats.statesAfterSteps(steps);

    const prefix = new StablePrefix();
    CircuitStats.fromCircuitAtTime(definition, 0.3, "seed", prefix);
    // Spoil the state that is kept. A run that really starts from it cannot then agree with a whole run,
    // from the step at its end on.
    Shaders.color(0, 0, 0, 0).renderTo(prefix.heldFor(definition, "seed").state);
    const spoilt = stats.statesAfterSteps(steps.slice(kept), prefix);
    for (const [i, state] of spoilt.entries()) {
        assertThat(state).withInfo({step: kept + i}).isNotApproximatelyEqualTo(full[kept + i], 1e-3);
    }

    // The prefix is not used when a step is before it, since it holds only the state at its end.
    const before = stats.statesAfterSteps([kept - 1, kept + 1, count], prefix);
    assertThat(before).isEqualTo([full[kept - 1], full[kept + 1], full[count]]);
    // Nor for another seed, or another circuit, or once it has been let go of.
    const reseeded = CircuitStats.fromCircuitAtTime(definition, 0.3, "another seed");
    assertThat(reseeded.statesAfterSteps(steps.slice(kept), prefix)).
        isEqualTo(reseeded.statesAfterSteps(steps.slice(kept)));
    const edited = definition.withColumns([new GateColumn([Gates.HalfTurns.Z, undefined]), ...definition.columns.slice(1)]);
    const editedStats = CircuitStats.fromCircuitAtTime(edited, 0.3, "seed");
    assertThat(editedStats.statesAfterSteps(steps.slice(kept), prefix)).
        isEqualTo(editedStats.statesAfterSteps(steps.slice(kept)));
    prefix.release();
    assertThat(stats.statesAfterSteps(steps.slice(kept), prefix)).isEqualTo(stats.statesAfterSteps(steps.slice(kept)));
});

suite.testUsingWebGL("random circuits give the same states from the kept prefix as from the start", () => {
    let fromPrefix = 0;
    for (let i = 0; i < 60; i++) {
        const definition = randomCircuit(`step states ${i}`).withMinimumWireCount();
        const seed = `step seed ${i}`;
        const prefix = new StablePrefix();
        const kept = StablePrefix.keptLength(definition);
        const steps = Array.from({length: definition.columns.length + 1}, (_, k) => k);
        for (const time of [0.1, 0.6]) {
            const stats = CircuitStats.fromCircuitAtTime(definition, time, seed, prefix);
            const full = stats.statesAfterSteps(steps);
            const after = steps.slice(kept);
            const ran = stats.statesAfterSteps(after, prefix);
            // Bit for bit, though a state is NaN where the circuit cannot survive to it.
            for (const [j, k] of after.entries()) {
                assertThat(sameData(ran[j], full[k])).withInfo({circuit: definition.toString(), seed, time, k}).
                    isEqualTo(true);
            }
            if (prefix.heldFor(definition, seed)?.state !== undefined) {
                fromPrefix++;
            }
        }
        prefix.release();
    }
    // The circuits cover those with a prefix to start from and those with none, or one that is not kept.
    assertTrue(fromPrefix >= 20, `${fromPrefix} runs from a prefix`);
});

suite.testUsingWebGL("a run that fails part way gives back every texture it took, wherever it started from", () => {
    const failure = new Error("this gate fails");
    // Each has a matrix, which is all the recovery from a failure needs to write the circuit out.
    const failing = new GateBuilder()
        .setSerializedId("fails-part-way")
        .setKnownEffectToMatrix(Matrix.square(0, 1, 1, 0))
        .setActualEffectToUpdateFunc(() => {
            throw failure;
        })
        .gate;
    const stat = new GateBuilder()
        .setSerializedId("stat-before-failing")
        .setKnownEffectToMatrix(Matrix.identity(2))
        .setStatTexturesMaker(() => [Shaders.color(1, 2, 3, 4).toVec4Texture(0), Shaders.color(5, 6, 7, 8).toVec4Texture(0)])
        .gate;
    // Before the failure a run has collected each kind of stat: a display's data, a qubit's density and
    // the chance of surviving a column. It holds the state in its trader, copies of it for the prefix to
    // keep and for the playhead, and the control texture of the column that fails.
    const extras = [['F', failing], ['G', stat], ['t', Gates.Powering.XForward]];
    const definition = circuit(`-H-G-@-!-t-F-X-
                                -H---X-@-Y-----`, ...extras).withMinimumWireCount();
    const working = circuit(`-H-G-@-!-t-Z-X-
                             -H---X-@-Y-----`, ...extras).withMinimumWireCount();
    const playhead = definition.withColumns(definition.columns.slice(0, 3));
    const fails = action => {
        const thrown = assertThrows(action).subject;
        assertThat(thrown === failure).withInfo({thrown: String(thrown), stack: thrown?.stack}).isEqualTo(true);
    };
    const before = WglTexturePool.getUnReturnedTextureCount();
    const returned = () => assertThat(WglTexturePool.getUnReturnedTextureCount()).isEqualTo(before);

    // A whole run, from the start.
    fails(() => CircuitStats._fromCircuitAtTime_noFallback(definition, 0.3, "seed"));
    returned();
    // A run that has copied the state at the end of the prefix, to keep once it has read the stats.
    const prefix = new StablePrefix();
    fails(() => CircuitStats.fromCircuitAtTime(definition, 0.3, "seed", prefix));
    assertTrue(prefix.heldFor(definition, "seed") === undefined);
    returned();
    // A run that starts from the prefix a working circuit made, which has the same columns before the failure.
    CircuitStats.fromCircuitAtTime(working, 0.3, "seed", prefix);
    assertTrue(prefix.heldFor(definition, "seed") !== undefined);
    fails(() => CircuitStats.fromCircuitAtTime(definition, 0.6, "seed", prefix));
    prefix.release();
    returned();
    // Runs that copy the state at the playhead, read at once and read in the background.
    fails(() => CircuitStats.fromCircuitAtTimeWithPlayhead(definition, playhead, 0.3, "seed"));
    returned();
    fails(() => CircuitStats.startFromCircuitAtTime(definition, playhead, 0.3, "seed"));
    returned();
    // The states after each step, which copy the state at every one.
    fails(() => CircuitStats.withNanDataFromCircuitAtTime(definition, 0.3).statesAfterSteps([0, 4, 8, 12]));
    returned();
});

suite.testUsingWebGL("empty", () => {
    const stats = CircuitStats.fromCircuitAtTime(CircuitDefinition.EMPTY.withWireCount(1), 0.1);
    assertThat(stats.finalState).isApproximatelyEqualTo(Matrix.col(1, 0));
    assertThat(stats.qubitDensityMatrix(Infinity, 0)).isApproximatelyEqualTo(Matrix.square(1, 0, 0, 0));
});

suite.testUsingWebGL("smoke", () => {
    const c = circuit(`--X-H---•⊕-
                     --•-H---XX-
                     -H--M--@---`);
    const stats = CircuitStats.fromCircuitAtTime(c, 0.1);
    assertTrue(stats.circuitDefinition.colHasControls(2));
    assertThat(stats.qubitDensityMatrix(7, 2)).isEqualTo(Matrix.square(0.5, 0, 0, 0.5));
});

function tryGateSequence(gates, maxHeight) {
    const pad = new Array(maxHeight - 1).fill(undefined);
    const cols = gates.
        filter(e => e !== Gates.Special.Measurement && e !== Gates.ErrorInjection && e.height <= maxHeight).
        map(e => new GateColumn([e, ...pad]));
    const c = new CircuitDefinition(maxHeight, cols);
    const stats = CircuitStats.fromCircuitAtTime(c, 0.1);
    assertThat(stats).isNotEqualTo(undefined);
}

// Try known gates, but in separate tests to avoid blowing the per-test time limit warning.
const knownGateStripes = 32;
for (let knownGateOffset = 0; knownGateOffset < knownGateStripes; knownGateOffset++) {
    suite.testUsingWebGL(`try-known-gates-in-sequence-${knownGateOffset+1}-of-${knownGateStripes}`, () => {
        const stripe = Gates.KnownToSerializer.
            filter((_, i) => i >= knownGateOffset && (i - knownGateOffset) % knownGateStripes === 0);
        tryGateSequence(stripe, 5);
    });
}

suite.testUsingWebGL("nested-addition-gate", () => {
    const circuitDef = Serializer.fromJson(
        CircuitDefinition,
        {cols:[[1,"X"],[1,"~f2fa"]],gates:[{id:"~f2fa",circuit:{cols:[["+=A1","inputA1"]]}}]});
    const stats = CircuitStats.fromCircuitAtTime(circuitDef, 0);
    const off = Matrix.square(1, 0, 0, 0);
    const on = Matrix.square(0, 0, 0, 1);
    assertThat(stats.qubitDensityMatrix(Infinity, 0)).isEqualTo(off);
    assertThat(stats.qubitDensityMatrix(Infinity, 1)).isEqualTo(on);
    assertThat(stats.qubitDensityMatrix(Infinity, 2)).isEqualTo(off);
});

suite.testUsingWebGL('controlled-displays', () => {
    const c = circuit(`-H-•-@@-
                     ---X-⊕•-`);
    const stats = CircuitStats.fromCircuitAtTime(c, 0);
    assertThat(stats.qubitDensityMatrix(5, 0)).isApproximatelyEqualTo(Matrix.square(0.5, 0.5, 0.5, 0.5));
    assertThat(stats.qubitDensityMatrix(6, 0)).isApproximatelyEqualTo(Matrix.square(0, 0, 0, 1));
});

suite.testUsingWebGL('incoherent-amplitude-display', () => {
    const c = circuit(`-H-•-a-
                     ---X---`, ['a', Gates.Displays.AmplitudeDisplayFamily.ofSize(1)]);
    const stats = CircuitStats.fromCircuitAtTime(c, 0);
    assertThat(stats.qubitDensityMatrix(Infinity, 0)).isApproximatelyEqualTo(Matrix.square(0.5, 0, 0, 0.5));
    assertThat(stats.qubitDensityMatrix(Infinity, 1)).isApproximatelyEqualTo(Matrix.square(0.5, 0, 0, 0.5));
    assertThat(stats.customStatsForSlot(5, 0)).isApproximatelyEqualTo({
        quality: 0.5,
        ket: Matrix.fromRows([[1, 0]]),
        phaseLockIndex: 0,
        incoherentKet: Matrix.fromRows([[Math.sqrt(0.5), Math.sqrt(0.5)]])
    });
});

suite.testUsingWebGL('coherent-amplitude-display', () => {
    const c = circuit(`-H-•-a/--
                     ---X-//--
                     -H-------`, ['a', Gates.Displays.AmplitudeDisplayFamily]);
    const stats = CircuitStats.fromCircuitAtTime(c, 0);
    assertThat(stats.qubitDensityMatrix(Infinity, 0)).isApproximatelyEqualTo(Matrix.square(0.5, 0, 0, 0.5));
    assertThat(stats.qubitDensityMatrix(Infinity, 1)).isApproximatelyEqualTo(Matrix.square(0.5, 0, 0, 0.5));
    assertThat(stats.qubitDensityMatrix(Infinity, 2)).isApproximatelyEqualTo(Matrix.square(0.5, 0.5, 0.5, 0.5));
    assertThat(stats.customStatsForSlot(5, 0)).isApproximatelyEqualTo({
        quality: 1,
        ket: Matrix.square(1, 0, 0, 1).times(Math.sqrt(0.5)),
        incoherentKet: Matrix.square(1, 0, 0, 1).times(Math.sqrt(0.5)),
        phaseLockIndex: 0
    });
});

suite.testUsingWebGL('conditional-bloch-display', () => {
    const c = circuit(`-H-@-
                     -H-•-`);
    const stats = CircuitStats.fromCircuitAtTime(c, 0);
    assertThat(stats.qubitDensityMatrix(Infinity, 0)).isApproximatelyEqualTo(Matrix.square(0.5, 0.5, 0.5, 0.5));
    assertThat(stats.qubitDensityMatrix(Infinity, 1)).isApproximatelyEqualTo(Matrix.square(0.5, 0.5, 0.5, 0.5));
    assertThat(stats.qubitDensityMatrix(3, 0)).isApproximatelyEqualTo(Matrix.square(0.5, 0.5, 0.5, 0.5));
    assertThat(stats.customStatsForSlot(3, 0)).isEqualTo(undefined);
});

suite.testUsingWebGL('probability-display', () => {
    const c = circuit(`-H-•-%-
                     ---X-/-`, ['%', Gates.Displays.ProbabilityDisplayFamily]);
    const stats = CircuitStats.fromCircuitAtTime(c, 0);
    assertThat(stats.qubitDensityMatrix(Infinity, 0)).isApproximatelyEqualTo(Matrix.square(0.5, 0, 0, 0.5));
    assertThat(stats.customStatsForSlot(5, 0)).isApproximatelyEqualTo(
        Matrix.col(0.5, 0, 0, 0.5));
});

suite.testUsingWebGL('controlled-multi-probability-display', () => {
    const c = circuit(`---◦-
                     -H-%-
                     ---/-`, ['%', Gates.Displays.ProbabilityDisplayFamily]);
    const stats = CircuitStats.fromCircuitAtTime(c, 0);
    assertThat(stats.customStatsForSlot(3, 1)).isApproximatelyEqualTo(
        Matrix.col(0.5, 0.5, 0, 0));
});

suite.testUsingWebGL('density-display', () => {
    const c = circuit(`-d/-
                     -//-`, ['d', Gates.Displays.DensityMatrixDisplayFamily]);
    const stats = CircuitStats.fromCircuitAtTime(c, 0);
    assertThat(stats.customStatsForSlot(1, 0)).isApproximatelyEqualTo(
        Matrix.square(
            1, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0));
});

suite.testUsingWebGL('shifted-density-display', () => {
    const c = circuit(`----
                     -d/-
                     -//-`, ['d', Gates.Displays.DensityMatrixDisplayFamily]);
    const stats = CircuitStats.fromCircuitAtTime(c, 0);
    assertThat(stats.customStatsForSlot(1, 1)).isApproximatelyEqualTo(
        Matrix.square(
            1, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0));
});

suite.testUsingWebGL('16-qubit-hadamard-transform', () => {
    const stats = CircuitStats.fromCircuitAtTime(circuit(`-H-
                                                        -H-
                                                        -H-
                                                        -H-
                                                        -H-
                                                        -H-
                                                        -H-
                                                        -H-
                                                        -H-
                                                        -H-
                                                        -H-
                                                        -H-
                                                        -H-
                                                        -H-
                                                        -H-
                                                        -H-`), 0);

    // This is a lot of values to check. Don't pay the cost of wrapping in assertThat.
    const buf = stats.finalState.rawBuffer();
    for (let i = 0; i*2 < buf.length; i++) {
        if (buf[i*2 + 1] !== 0) {
            assertThat(buf[i * 2 + 1]).withInfo({i}).isEqualTo(0);
        }
        if (Math.abs(buf[i * 2] * 256.0 - 1.0) > 0.00001) {
            assertThat(buf[i * 2]).withInfo({i}).isApproximatelyEqualTo(1/256);
        }
    }

    // Check densities.
    for (let i = 0; i < 16; i++) {
        assertThat(stats.qubitDensityMatrix(Infinity, i)).
            withInfo({i}).
            isApproximatelyEqualTo(Matrix.square(0.5, 0.5, 0.5, 0.5), 0.000001);
    }

    // And unity.
    assertThat(stats.survivalRate(Infinity)).isApproximatelyEqualTo(1, 0.0001);
});

suite.testUsingWebGL('survival-rates', () => {
    const stats = CircuitStats.fromCircuitAtTime(circuit(`-H-!-------
                                                        ---X-!-----
                                                        -------H-!-
                                                        -----------`), 0);

    assertThat(stats.survivalRate(-1)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(0)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(1)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(2)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(3)).isApproximatelyEqualTo(0.5);
    assertThat(stats.survivalRate(4)).isApproximatelyEqualTo(0.5);
    assertThat(stats.survivalRate(5)).isApproximatelyEqualTo(0.5);
    assertThat(stats.survivalRate(6)).isApproximatelyEqualTo(0.5);
    assertThat(stats.survivalRate(7)).isApproximatelyEqualTo(0.5);
    assertThat(stats.survivalRate(8)).isApproximatelyEqualTo(0.5);
    assertThat(stats.survivalRate(7)).isApproximatelyEqualTo(0.5);
    assertThat(stats.survivalRate(8)).isApproximatelyEqualTo(0.5);
    assertThat(stats.survivalRate(9)).isApproximatelyEqualTo(0.25);
    assertThat(stats.survivalRate(10)).isApproximatelyEqualTo(0.25);
    assertThat(stats.survivalRate(Infinity)).isApproximatelyEqualTo(0.25);
});

suite.testUsingWebGL('survival-rates-controlled-postselection', () => {
    const stats = CircuitStats.fromCircuitAtTime(circuit(`---•-H-•-!---•-
                                                        -X-!-X-X-•-X-!-`), 0);
    assertThat(stats.survivalRate(2)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(3)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(4)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(5)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(6)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(7)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(8)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(9)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(10)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(11)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(12)).isApproximatelyEqualTo(1);
    assertThat(stats.survivalRate(13)).isApproximatelyEqualTo(0.5);
    assertThat(stats.survivalRate(14)).isApproximatelyEqualTo(0.5);
});

suite.testUsingWebGL('dynamic-phase-gradient-keeps-qubits-coherent', () => {
    const stats = CircuitStats.fromCircuitAtTime(
        circuit(`-H-P-
                 -H-/-
                 -H-/-
                 -H-/-
                 -H-/-
                 -H-/-
                 -H-/-
                 -H-/-
                 -H-/-
                 -H-/-
                 -H-/-
                 -H-/-
                 -H-/-
                 -H-/-
                 -H-/-
                 -H-/-`, ['P', Gates.PhaseGradientGates.DynamicPhaseGradientFamily]),
        0.9);

    // Check coherence of each qubit.
    for (let i = 0; i < 16; i++) {
        const [x, y, z] = QubitMatrix.densityMatrixToBlochVector(stats.qubitDensityMatrix(Infinity, i));
        const r = x*x + y*y + z*z;
        assertThat(r).withInfo({i, x, y, z}).isApproximatelyEqualTo(1, 0.00001);
    }
});

suite.testUsingWebGL('classical-swap-with-quantum-control-does-not-fire', () => {
    // Swap should be disabled.
    const c = circuit(`-M-X-S-
                     -M---S-
                     ---X-•-`, ['S', Gates.Special.SwapHalf]);
    assertThat(c.gateAtLocIsDisabledReason(5, 0)).isNotEqualTo(undefined);
    assertThat(c.gateAtLocIsDisabledReason(5, 1)).isNotEqualTo(undefined);
    assertThat(c.gateAtLocIsDisabledReason(5, 2)).isEqualTo(undefined);

    // And swap should not have fired.
    const stats = CircuitStats.fromCircuitAtTime(c, 0);
    assertThat(stats.qubitDensityMatrix(Infinity, 0)).isEqualTo(Matrix.square(0, 0, 0, 1));
    assertThat(stats.qubitDensityMatrix(Infinity, 1)).isEqualTo(Matrix.square(1, 0, 0, 0));
    assertThat(stats.qubitDensityMatrix(Infinity, 2)).isEqualTo(Matrix.square(0, 0, 0, 1));
});

suite.testUsingWebGL('classical-swap-with-classical-control-does-fire', () => {
    // Swap should be disabled.
    const c = circuit(`-M-X-S-
                     -M---S-
                     -M-X-•-`, ['S', Gates.Special.SwapHalf]);
    assertThat(c.gateAtLocIsDisabledReason(5, 0)).isEqualTo(undefined);
    assertThat(c.gateAtLocIsDisabledReason(5, 1)).isEqualTo(undefined);
    assertThat(c.gateAtLocIsDisabledReason(5, 2)).isEqualTo(undefined);

    // And swap should not have fired.
    const stats = CircuitStats.fromCircuitAtTime(c, 0);
    assertThat(stats.qubitDensityMatrix(Infinity, 0)).isEqualTo(Matrix.square(1, 0, 0, 0));
    assertThat(stats.qubitDensityMatrix(Infinity, 1)).isEqualTo(Matrix.square(0, 0, 0, 1));
    assertThat(stats.qubitDensityMatrix(Infinity, 2)).isEqualTo(Matrix.square(0, 0, 0, 1));
});

suite.testUsingWebGL('classical-bit-rotate-with-quantum-control-does-not-fire', () => {
    // Bit rotation should be disabled.
    const c = circuit(`-M-X-<-
                     -M---/-
                     ---X-•-`, ['<', Gates.CycleBitsGates.CycleBitsFamily]);
    assertThat(c.gateAtLocIsDisabledReason(5, 0)).isNotEqualTo(undefined);
    assertThat(c.gateAtLocIsDisabledReason(5, 2)).isEqualTo(undefined);

    // And bit rotation should not fire.
    const stats = CircuitStats.fromCircuitAtTime(c, 0);
    assertThat(stats.qubitDensityMatrix(Infinity, 0)).isEqualTo(Matrix.square(0, 0, 0, 1));
    assertThat(stats.qubitDensityMatrix(Infinity, 1)).isEqualTo(Matrix.square(1, 0, 0, 0));
    assertThat(stats.qubitDensityMatrix(Infinity, 2)).isEqualTo(Matrix.square(0, 0, 0, 1));
});

suite.testUsingWebGL('classical-bit-rotate-with-classical-control-does-fire', () => {
    // Bit rotation should be disabled.
    const c = circuit(`-M-X-<-
                     -M---/-
                     -M-X-•-`, ['<', Gates.CycleBitsGates.CycleBitsFamily]);
    assertThat(c.gateAtLocIsDisabledReason(5, 0)).isEqualTo(undefined);
    assertThat(c.gateAtLocIsDisabledReason(5, 2)).isEqualTo(undefined);

    // And bit rotation should not fire.
    const stats = CircuitStats.fromCircuitAtTime(c, 0);
    assertThat(stats.qubitDensityMatrix(Infinity, 0)).isEqualTo(Matrix.square(1, 0, 0, 0));
    assertThat(stats.qubitDensityMatrix(Infinity, 1)).isEqualTo(Matrix.square(0, 0, 0, 1));
    assertThat(stats.qubitDensityMatrix(Infinity, 2)).isEqualTo(Matrix.square(0, 0, 0, 1));
});

suite.testUsingWebGL("initial_states", () => {
    const circuit = Serializer.fromJson(CircuitDefinition, {
        init: [0, 1, '+', '-', 'i', '-i'],
        cols: [],
    });
    const stats = CircuitStats.fromCircuitAtTime(circuit, 0);
    assertThat(QubitMatrix.densityMatrixToBlochVector(stats.qubitDensityMatrix(9, 0))).isApproximatelyEqualTo([0, 0, -1]);
    assertThat(QubitMatrix.densityMatrixToBlochVector(stats.qubitDensityMatrix(9, 1))).isApproximatelyEqualTo([0, 0, +1]);
    assertThat(QubitMatrix.densityMatrixToBlochVector(stats.qubitDensityMatrix(9, 2))).isApproximatelyEqualTo([-1, 0, 0]);
    assertThat(QubitMatrix.densityMatrixToBlochVector(stats.qubitDensityMatrix(9, 3))).isApproximatelyEqualTo([+1, 0, 0]);
    assertThat(QubitMatrix.densityMatrixToBlochVector(stats.qubitDensityMatrix(9, 4))).isApproximatelyEqualTo([0, +1, 0]);
    assertThat(QubitMatrix.densityMatrixToBlochVector(stats.qubitDensityMatrix(9, 5))).isApproximatelyEqualTo([0, -1, 0]);
});

suite.testUsingWebGL("distillation", () => {
    const c = circuit(
        `
        -X-X--X-X--X-X--X-X-------X-X--X-X-------X-X------------HTH-0-
        -X-X--X-X--X-X-------X-X--X-X-------X-X-------X-X-------HTH-0-
        -X-X--X-X-------X-X--X-X-------X-X--X-X------------X-X--HTH-0-
        -X-X-------X-X--X-X--X-X-----------------X-X--X-X--X-X--HTH-0-
        -X-X----------------------X-X--X-X--X-X--X-X--X-X--X-X--------
        -#T]--#T]--#T]--#T]--#T]--#T]--#T]--#T]--#T]--#T]--#T]--------
        `,
        [']', Gates.Detectors.XDetectControlClear],
        ['0', Gates.PostSelectionGates.PostSelectOff],
        ['#', Gates.Controls.XControl],
        ['T', Gates.OtherZ.Z4]);
    for (let i = 0; i < 5; i++) {
        const stats = CircuitStats.fromCircuitAtTime(c, 0);
        assertThat(QubitMatrix.densityMatrixToBlochVector(stats.qubitDensityMatrix(Infinity, 4))).isApproximatelyEqualTo(
            [0, Math.sqrt(0.5), -Math.sqrt(0.5)]);
        assertThat(stats.survivalRate(Infinity)).isApproximatelyEqualTo(1, 0.001);
    }
});

suite.testUsingWebGL("toReadableJson", () => {
    const c = circuit(
        `
        --%D
        H@/-
        `,
        ['%', Gates.Displays.ProbabilityDisplayFamily],
        ['D', Gates.Detectors.ZDetector]
    );
    const stats = CircuitStats.fromCircuitAtTime(c, 0.5);
    const json = stats.toReadableJson();
    assertThat(json).isApproximatelyEqualTo({
        circuit: Serializer.toJson(c),
        output_amplitudes: [
            {r: Math.sqrt(0.5), i: 0},
            {r: 0, i: 0},
            {r: Math.sqrt(0.5), i: 0},
            {r: 0, i: 0},
        ],
        time_parameter: 0.5,
        chance_of_surviving_to_each_column: [1, 1, 1, 1],
        computed_bloch_vectors_by_column_then_wire: [
            [null, null],
            [null, {x: +1, y: 0, z: 0}],
            [null, null],
            [null, null],
            [{x: 0, y: 0, z: +1}, {x: +1, y: 0, z: 0}],
        ],
        displays: [
            {
                location: {wire: 0, column: 2},
                type: {serialized_id: "Chance2", name: "Probability Display"},
                data: {probabilities: [0.5, 0, 0.5, 0]}
            },
            {
                location: {wire: 0, column: 3},
                type: {serialized_id: "ZDetector", name: "Z Axis Detector"},
                data: false
            }
        ]
    })
});
