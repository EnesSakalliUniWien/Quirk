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

import {CircuitDefinition} from "../../../src/circuit/model/CircuitDefinition.js"
import {GateColumn} from "../../../src/circuit/model/GateColumn.js"
import {Gates} from "../../../src/gates/AllGates.js"
import {randomFor} from "../../../src/engine/simulation/random.js"

/**
 * Random circuits for tests that compare two ways of working out the same stats, with a seed so that
 * a failure can be run again. They mix everything a column can hold that a run treats differently:
 * gates that stay as they are and gates that move with time, controls, swaps, measurement,
 * post-selection, displays of one and of several wires, and detectors, which draw random numbers.
 */

const STILL = [
    Gates.HalfTurns.H, Gates.HalfTurns.X, Gates.HalfTurns.Y, Gates.HalfTurns.Z,
    Gates.QuarterTurns.SqrtXForward, Gates.QuarterTurns.SqrtZForward,
];
const MOVING = [
    Gates.Powering.XForward, Gates.Powering.YForward, Gates.Powering.ZForward,
    Gates.Exponentiating.XForward, Gates.Exponentiating.ZForward,
];
const CONTROLS = [Gates.Controls.Control, Gates.Controls.AntiControl, Gates.Controls.XAntiControl];
const SINGLE_DISPLAYS = [
    Gates.Displays.ChanceDisplay, Gates.Displays.BlochSphereDisplay, Gates.Displays.DensityMatrixDisplay,
    Gates.Displays.SampleDisplayFamily.ofSize(1), Gates.Displays.AmplitudeDisplayFamily.ofSize(1),
];
const WIDE_DISPLAYS = [
    Gates.Displays.DensityMatrixDisplay2, Gates.Displays.AmplitudeDisplayFamily.ofSize(2),
    Gates.Displays.SampleDisplayFamily.ofSize(2), Gates.Displays.ProbabilityDisplayFamily.ofSize(2),
];
const POST_SELECTIONS = [Gates.PostSelectionGates.PostSelectOn, Gates.PostSelectionGates.PostSelectOff];
const WIDE_MOVING = [
    Gates.CountingGates.CountingFamily.ofSize(2), Gates.PhaseGradientGates.DynamicPhaseGradientFamily.ofSize(2),
];

/**
 * @param {!function(): !number} rng
 * @param {!int} numWires
 * @param {!{moving: !boolean, mustMove: !boolean, detectors: !boolean}} kinds Whether the column may
 *     hold a gate that moves with time, must, and may hold a detector.
 * @returns {!GateColumn}
 */
function randomColumn(rng, numWires, {moving, mustMove, detectors}) {
    const pick = list => list[Math.floor(rng() * list.length)];
    const gates = new Array(numWires).fill(undefined);
    const used = new Set();
    const put = (gate, row) => {
        if (row < 0 || row + gate.height > numWires) {
            return false;
        }
        for (let i = 0; i < gate.height; i++) {
            if (used.has(row + i)) {
                return false;
            }
        }
        for (let i = 0; i < gate.height; i++) {
            used.add(row + i);
        }
        gates[row] = gate;
        return true;
    };
    const anyRow = () => Math.floor(rng() * numWires);

    if (mustMove) {
        put(pick(MOVING), anyRow());
    }
    const count = Math.floor(rng() * 3) + 1;
    for (let i = 0; i < count; i++) {
        const kind = rng();
        if (kind < 0.30) {
            put(pick(STILL), anyRow());
        } else if (kind < 0.42) {
            if (moving) {
                put(pick(MOVING), anyRow());
            }
        } else if (kind < 0.54) {
            // A control, with the gate it controls.
            const control = anyRow();
            if (put(pick(CONTROLS), control)) {
                put(pick(STILL), anyRow()) || put(pick(STILL), anyRow());
            }
        } else if (kind < 0.62) {
            put(Gates.Special.Measurement, anyRow());
        } else if (kind < 0.68) {
            put(pick(POST_SELECTIONS), anyRow());
        } else if (kind < 0.82) {
            put(pick(SINGLE_DISPLAYS), anyRow());
        } else if (kind < 0.87) {
            put(pick(WIDE_DISPLAYS), anyRow());
        } else if (kind < 0.91) {
            const first = anyRow();
            put(Gates.Special.SwapHalf, first) && put(Gates.Special.SwapHalf, anyRow());
        } else if (kind < 0.95) {
            if (detectors) {
                put(Gates.Detectors.ZDetector, anyRow());
            }
        } else if (moving) {
            put(pick(WIDE_MOVING), anyRow());
        }
    }
    return new GateColumn(gates);
}

/**
 * @param {!string} seed
 * @param {!{detectors: (!boolean|undefined), moving: (!boolean|undefined)}=} options Whether detectors may
 *     appear, and whether any gate moves with time (the default).
 * @returns {!CircuitDefinition} A circuit of two to four wires and three to eight columns. Its first
 *     moving gate is in a column of its own choosing, from the first to the last, unless it has none.
 */
function randomCircuit(seed, {detectors = true, moving = true} = {}) {
    const rng = randomFor(`random circuit ${seed}`);
    const numWires = 2 + Math.floor(rng() * 3);
    const count = 3 + Math.floor(rng() * 6);
    const firstMoving = moving ? Math.floor(rng() * count) : Infinity;
    const columns = Array.from({length: count}, (_, col) => randomColumn(rng, numWires, {
        moving: col >= firstMoving,
        mustMove: col === firstMoving,
        detectors,
    }));
    let circuit = new CircuitDefinition(numWires, columns);
    if (rng() < 0.3) {
        circuit = circuit.withSwitchedInitialStateOn(Math.floor(rng() * numWires), ["1", "+", "-", "i"][Math.floor(rng() * 4)]);
    }
    return circuit;
}

export {randomCircuit}
