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

import {perfGoal, millis} from "./TestPerfUtil.js"
import {CircuitDefinition} from "../src/circuit/model/CircuitDefinition.js"
import {CircuitStats} from "../src/engine/simulation/CircuitStats.js"
import {Gate} from "../src/circuit/model/Gate.js"
import {Gates} from "../src/gates/AllGates.js"
import {QubitMatrix} from "../src/engine/math/matrix/QubitMatrix.js"
import {GateColumn} from "../src/circuit/model/GateColumn.js"
import {CircuitCheckpoints} from "../src/engine/simulation/CircuitCheckpoints.js"

const diagram = (diagram, ...extras) => CircuitDefinition.fromTextDiagram(new Map([
    ...extras,
    ['•', Gates.Controls.Control],
    ['X', Gates.HalfTurns.X],
    ['Y', Gates.HalfTurns.Y],
    ['Z', Gates.HalfTurns.Z],
    ['H', Gates.HalfTurns.H],
    ['1', Gates.QuarterTurns.SqrtZForward],
    ['2', Gates.OtherZ.Z4],
    ['3', Gates.OtherZ.Z8],
    ['4', Gates.OtherZ.Z16],
    ['5', Gates.OtherZ.Z32],
    ['6', Gates.OtherZ.Z64],
    ['7', Gates.OtherZ.Z128],
    ['8', Gate.fromKnownMatrix("8", QubitMatrix.fromPauliRotation(0, 0, 1/(1<<9)))],
    ['9', Gate.fromKnownMatrix("9", QubitMatrix.fromPauliRotation(0, 0, 1/(1<<10)))],
    ['A', Gate.fromKnownMatrix("A", QubitMatrix.fromPauliRotation(0, 0, 1/(1<<11)))],
    ['B', Gate.fromKnownMatrix("B", QubitMatrix.fromPauliRotation(0, 0, 1/(1<<12)))],
    ['C', Gate.fromKnownMatrix("C", QubitMatrix.fromPauliRotation(0, 0, 1/(1<<13)))],
    ['D', Gate.fromKnownMatrix("D", QubitMatrix.fromPauliRotation(0, 0, 1/(1<<14)))],
    ['E', Gate.fromKnownMatrix("E", QubitMatrix.fromPauliRotation(0, 0, 1/(1<<15)))],
    ['F', Gate.fromKnownMatrix("F", QubitMatrix.fromPauliRotation(0, 0, 1/(1<<16)))],
    ['-', undefined],
    ['/', null],
    ['Q', Gates.FourierTransformGates.InverseFourierTransformFamily],
    ['o', Gates.Displays.BlochSphereDisplay],
    ['p', Gates.Displays.ChanceDisplay]
]), diagram);

perfGoal(
    "Empty Circuit",
    millis(4),
    circuit => CircuitStats.fromCircuitAtTime(circuit, 0),
    diagram(''));

perfGoal(
    "2-Qubit QFT gate with manual de-QFT",
    millis(10),
    circuit => CircuitStats.fromCircuitAtTime(circuit, 0),
    diagram(`-Q-H-1---
             -/---•-H-`));

perfGoal(
    "4-Qubit QFT gate with manual de-QFT",
    millis(12),
    circuit => CircuitStats.fromCircuitAtTime(circuit, 0),
    diagram(`-Q-H-1---2---3---
             -/---•-H-1---2---
             -/-------•-H-1---
             -/-----------•-H-`));

perfGoal(
    "8-Qubit QFT gate with manual de-QFT",
    millis(20),
    circuit => CircuitStats.fromCircuitAtTime(circuit, 0),
    diagram(`-Q-H-1---2---3---4---5---6---7---
             -/---•-H-1---2---3---4---5---6---
             -/-------•-H-1---2---3---4---5---
             -/-----------•-H-1---2---3---4---
             -/---------------•-H-1---2---3---
             -/-------------------•-H-1---2---
             -/-----------------------•-H-1---
             -/---------------------------•-H-`));

const QFT_16 = diagram(`-Q-H-1---2---3---4---5---6---7---8---9---A---B---C---D---E---F---
             -/---•-H-1---2---3---4---5---6---7---8---9---A---B---C---D---E---
             -/-------•-H-1---2---3---4---5---6---7---8---9---A---B---C---D---
             -/-----------•-H-1---2---3---4---5---6---7---8---9---A---B---C---
             -/---------------•-H-1---2---3---4---5---6---7---8---9---A---B---
             -/-------------------•-H-1---2---3---4---5---6---7---8---9---A---
             -/-----------------------•-H-1---2---3---4---5---6---7---8---9---
             -/---------------------------•-H-1---2---3---4---5---6---7---8---
             -/-------------------------------•-H-1---2---3---4---5---6---7---
             -/-----------------------------------•-H-1---2---3---4---5---6---
             -/---------------------------------------•-H-1---2---3---4---5---
             -/-------------------------------------------•-H-1---2---3---4---
             -/-----------------------------------------------•-H-1---2---3---
             -/---------------------------------------------------•-H-1---2---
             -/-------------------------------------------------------•-H-1---
             -/-----------------------------------------------------------•-H-`);

perfGoal(
    "16-Qubit QFT gate with manual de-QFT",
    millis(75),
    circuit => CircuitStats.fromCircuitAtTime(circuit, 0),
    QFT_16);
perfGoal(
    "16-Qubit circuit with a display in every column",
    millis(100),
    circuit => CircuitStats.fromCircuitAtTime(circuit, 0),
    diagram(`-H-•-o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H-X-o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-
             -H---o-p-o-p-o-p-o-p-o-p-o-p-o-p-o-p-`));

/**
 * Runs a circuit again and again through one set of checkpoints, each time at a new time or with a
 * different last column, the way the app does while a gate animates or while one is being edited.
 */
const resumedRuns = (circuit, vary) => {
    let i = 0;
    return {
        method: ({checkpoints}) => {
            i++;
            const {c, time} = vary(circuit, i);
            return CircuitStats.fromCircuitAtTime(c, time, "perf", checkpoints);
        },
        arg: {checkpoints: new CircuitCheckpoints()},
        cleanup: ({checkpoints}) => checkpoints.release()
    };
};

const lastColumn = gate => new GateColumn([gate, ...new Array(15).fill(undefined)]);

const animated = resumedRuns(
    QFT_16.withColumns([...QFT_16.columns, lastColumn(Gates.Powering.XForward)]),
    (c, i) => ({c, time: i / 100}));
perfGoal(
    "16-Qubit QFT animated in its last column, resumed",
    millis(75),
    animated.method,
    animated.arg,
    animated.cleanup);

const edited = resumedRuns(QFT_16, (c, i) => ({
    c: c.withColumns([...c.columns, lastColumn(i % 2 === 0 ? Gates.HalfTurns.X : Gates.HalfTurns.Y)]),
    time: 0
}));
perfGoal(
    "16-Qubit QFT with its last column edited, resumed",
    millis(75),
    edited.method,
    edited.arg,
    edited.cleanup);

/**
 * Layers of single-qubit gates on every wire, each followed by nearest-neighbour CNOTs: the shape
 * gate fusion is for, since each pair's gates fit in one small matrix.
 */
const brickwork = (() => {
    const singles = [Gates.HalfTurns.H, Gates.OtherZ.Z4, Gates.QuarterTurns.SqrtXForward];
    const columns = [];
    for (let layer = 0; layer < 10; layer++) {
        columns.push(new GateColumn(Array.from({length: 16}, (_, wire) => singles[(wire + layer) % singles.length])));
        for (let pair = layer % 2; pair + 1 < 16; pair += 2) {
            const gates = new Array(16).fill(undefined);
            gates[pair] = Gates.Controls.Control;
            gates[pair + 1] = Gates.HalfTurns.X;
            columns.push(new GateColumn(gates));
        }
    }
    return new CircuitDefinition(16, columns);
})();
perfGoal(
    "16-Qubit brickwork of single-qubit layers and neighbouring CNOTs",
    millis(30),
    circuit => CircuitStats.fromCircuitAtTime(circuit, 0),
    brickwork);
