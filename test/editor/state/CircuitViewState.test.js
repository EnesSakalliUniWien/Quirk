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

import {Suite, assertThat, assertThrows} from '../../TestUtil.js';
import {CircuitViewState} from '../../../src/editor/state/CircuitViewState.js';
import {displayedCircuitFromTextDiagram} from '../DisplayedCircuitTestUtil.js';

import {CircuitDefinition} from '../../../src/circuit/model/CircuitDefinition.js';
import {Gates} from '../../../src/gates/AllGates.js';
import {Layout} from '../../../src/config/Layout.js';
import {CIRCUIT_OP_LEFT_SPACING} from '../../../src/editor/geometry/CircuitLayoutConstants.js';
import {Point} from '../../../src/geometry/Point.js';
import {PointerInteractionState} from '../../../src/editor/interaction/PointerInteractionState.js';
import {rectForResizeTab} from '../../../src/draw/gate/GateRects.js';

const COMMON_GATES = new Map([
    ['X', Gates.HalfTurns.X],
    ['Y', Gates.HalfTurns.Y],
    ['Z', Gates.HalfTurns.Z],
    ['H', Gates.HalfTurns.H],
    ['Q', Gates.FourierTransformGates.FourierTransformFamily],
    ['•', Gates.Controls.Control],
    ['◦', Gates.Controls.AntiControl],

    ['M', Gates.Special.Measurement],
    ['%', Gates.Displays.ChanceDisplay],
    ['@', Gates.Displays.BlochSphereDisplay],
    ['s', Gates.Special.SwapHalf],
    ['!', Gates.PostSelectionGates.PostSelectOn],

    ['-', undefined],
    ['+', undefined],
    ['0', null],
    ['1', null],
    ['2', null],
    ['3', null],
    ['4', null],
    ['5', null],
    ['6', null],
    ['7', null],
    ['8', null],
    ['9', null],

    ['/', null]
]);

const circuit = (diagramText, ...extraGateEntries) => CircuitDefinition.fromTextDiagram(
    new Map([
        ...COMMON_GATES.entries(),
        ...extraGateEntries
    ]),
    diagramText);

/**
 * @param {!string} diagramText
 * @param {!Array<*>} extraGateEntries
 * @returns {!{circuit: !CircuitViewState, pts: !Array.<!Point>}}
 */
const displayedCircuit = (diagramText, ...extraGateEntries) => displayedCircuitFromTextDiagram(
    new Map([
        ...COMMON_GATES.entries(),
        ...extraGateEntries
    ]),
    diagramText);

/**
 * @param {!string} diagramText
 * @param {undefined|!{duplicate: undefined|!boolean, wholeColumn: undefined|!boolean}} options
 * @param {!Array<*>} extraGateEntries
 * @returns {{
 *   beforeGrab: !CircuitViewState,
 *   afterGrab: !CircuitViewState,
 *   hovers: !Array.<!CircuitViewState>,
 *   afterDrop: !CircuitViewState,
 *   afterDropAndTidy: !CircuitViewState,
 * }}
 */
const simulateDrag = (diagramText, options={}, ...extraGateEntries) => {
    const duplicate = options.duplicate || false;
    const wholeColumn = options.wholeColumn || false;

    const {circuit: beforeGrab, pts} = displayedCircuit(diagramText, ...extraGateEntries);
    const {newCircuit: afterGrab, newHand: fullHand} =
        beforeGrab.tryGrab(PointerInteractionState.EMPTY.withPos(pts[0]), duplicate, wholeColumn);
    const hovers = [];
    for (const pt of pts) {
        hovers.push(afterGrab.previewDrop(fullHand.withPos(pt)));
    }
    const afterDrop = afterGrab.afterDropping(fullHand.withPos(pts.at(-1)));
    const afterDropAndTidy = afterDrop.afterTidyingUp();
    return {beforeGrab, afterGrab, hovers, afterDrop, afterDropAndTidy};
};

const suite = new Suite("CircuitViewState");

suite.test("constructor_vs_isEqualTo", () => {
    const d1 = CircuitDefinition.fromTextDiagram(COMMON_GATES, `+H+
                                                              X+Y`);
    const d2 = CircuitDefinition.fromTextDiagram(COMMON_GATES, `++++
                                                              ZHHH`);
    assertThrows(() => new CircuitViewState(23, "not a circuit", undefined, undefined, undefined));
    assertThrows(() => new CircuitViewState("not a number", d1, undefined, undefined, undefined));

    const c1 = new CircuitViewState(45, d1, undefined, undefined, undefined);
    const c2 = new CircuitViewState(67, d2, 1, {col: 1, row: 1, resizeStyle: true}, 1);
    assertThat(c1.top).isEqualTo(45);
    assertThat(c1.circuitDefinition).isEqualTo(d1);

    assertThat(c1).isEqualTo(c1);
    assertThat(c1).isNotEqualTo(c2);
    assertThat(c2).isEqualTo(c2);
    assertThat(c2).isNotEqualTo(c1);

    assertThat(c1).isEqualTo(new CircuitViewState(45, d1, undefined, undefined, undefined));
    assertThat(c1).isNotEqualTo(new CircuitViewState(46, d1, undefined, undefined, undefined));
    assertThat(c1).isNotEqualTo(new CircuitViewState(45, d2, undefined, undefined, undefined));
    assertThat(c1).isNotEqualTo(new CircuitViewState(45, d1, 1, undefined, undefined));
    assertThat(c1).isNotEqualTo(new CircuitViewState(45, d1, undefined, {col:1, row:1, resizeStyle:false}, undefined));
    assertThat(c1).isNotEqualTo(new CircuitViewState(45, d1, undefined, undefined, 0));

    assertThat(c2).isEqualTo(new CircuitViewState(67, d2, 1, {col: 1, row: 1, resizeStyle: true}, 1));
    assertThat(c2).isNotEqualTo(new CircuitViewState(68, d2, 1, {col: 1, row: 1, resizeStyle: true}, 1));
    assertThat(c2).isNotEqualTo(new CircuitViewState(67, d1, 1, {col: 1, row: 1, resizeStyle: true}, 1));
    assertThat(c2).isNotEqualTo(new CircuitViewState(67, d2, 2, {col: 1, row: 1, resizeStyle: true}, 1));
    assertThat(c2).isNotEqualTo(new CircuitViewState(67, d2, 1, {col: 2, row: 1, resizeStyle: true}, 1));
    assertThat(c2).isNotEqualTo(new CircuitViewState(67, d2, 1, {col: 2, row: 1, resizeStyle: true}, 2));

    assertThat(c2.withTop(89)).isEqualTo(
        new CircuitViewState(89, d2, 1, {col: 1, row: 1, resizeStyle: true}, 1));
});

suite.test("bootstrap_diagram", () => {
    assertThat(displayedCircuit(`|
                                 |-X-D//-
                                 |   ///
                                 |-+-///-
                                 |`,
                                 ['D', Gates.Displays.DensityMatrixDisplay2])).isEqualTo({
        circuit: new CircuitViewState(
            10,
            circuit(`XD/
                     +//`, ['D', Gates.Displays.DensityMatrixDisplay2]),
            undefined,
            undefined,
            undefined),
        pts: []
    });

    assertThat(displayedCircuit(`|
                                 |-+-H-+-
                                 |
                                 |-+-Y-+-
                                 |`)).isEqualTo({
        circuit: new CircuitViewState(
            10,
            circuit(`+H+
                     +Y+`),
            undefined,
            undefined,
            undefined),
        pts: []
    });

    assertThat(displayedCircuit(`|01
                                 |2+-H-+-
                                 |  3
                                 |-+-Y4+-
                                 |  5^   `)).isEqualTo({
        circuit: new CircuitViewState(
            10,
            circuit(`+H+
                     +Y+`),
            undefined,
            undefined,
            undefined),
        pts: [
            ...[[0, 0], [1, 0], [0, 1], [2, 2], [4, 3], [3, 3]].map(([col, row]) => new Point(
                CIRCUIT_OP_LEFT_SPACING + Layout.GATE_RADIUS - Layout.COLUMN_SPACING / 2 +
                    Layout.UNIT * 0.2 + 0.5 + col * Layout.COLUMN_SPACING / 2,
                10.5 + row * Layout.WIRE_SPACING / 2))
        ]
    });
});

suite.test("indexOfDisplayedRowAt", () => {
    const {circuit, pts} = displayedCircuit(`|0
                                           |1+-+-
                                           |   2
                                           |-+3+-
                                           |  4`);

    assertThat(circuit.indexOfDisplayedRowAt(-9999)).isEqualTo(undefined);
    assertThat(circuit.indexOfDisplayedRowAt(+9999)).isEqualTo(undefined);

    assertThat(circuit.indexOfDisplayedRowAt(pts[0].y)).isEqualTo(0);
    assertThat(circuit.indexOfDisplayedRowAt(pts[1].y)).isEqualTo(0);
    assertThat(circuit.indexOfDisplayedRowAt(pts[2].y)).isEqualTo(1);
    assertThat(circuit.indexOfDisplayedRowAt(pts[3].y)).isEqualTo(1);
    assertThat(circuit.indexOfDisplayedRowAt(pts[4].y)).isEqualTo(undefined);
});

suite.test("dragXIntoCNot", () => {
    const drag = simulateDrag(`|
                             |-H-•-X-
                             |    0^
                             |-+3421-
                             |`);

    assertThat(drag.beforeGrab.circuitDefinition).isEqualTo(circuit(`H•X
                                                                     ---`));
    assertThat(drag.afterGrab.circuitDefinition).isEqualTo(circuit(`H•-
                                                                    ---`));
    assertThat(drag.hovers.map(e => e.circuitDefinition)).isEqualTo([
        circuit(`H•X
                 ---`),
        circuit(`H•-
                 --X`),
        circuit(`H•--
                 --X-`),
        circuit(`H-•-
                 -X--`),
        circuit(`H•-
                 -X-`)]);
    assertThat(drag.afterDrop.circuitDefinition).isEqualTo(circuit(`H•-
                                                                    -X-`));
    assertThat(drag.afterDropAndTidy.circuitDefinition).isEqualTo(circuit(`H•
                                                                           -X`));
});

suite.test("resizeQft", () => {
    const beforeGrab = CircuitViewState.empty(10).withCircuit(circuit(`Q
        /
        -
        -`));
    const tab = rectForResizeTab(beforeGrab.gateRect(0, 0, 1, 2));
    const start = tab.center();
    const {newCircuit: afterGrab, newHand} = beforeGrab.tryGrab(PointerInteractionState.EMPTY.withPos(start));
    const points = [start, start.plus(new Point(0, -Layout.WIRE_SPACING)),
        start.plus(new Point(0, 2 * Layout.WIRE_SPACING))];
    const afterDrop = afterGrab.afterDropping(newHand.withPos(points[2]));
    const drag = {beforeGrab, afterGrab, afterDrop,
        hovers: points.map(pt => afterGrab.previewDrop(newHand.withPos(pt))),
        afterDropAndTidy: afterDrop.afterTidyingUp()};

    assertThat(drag.beforeGrab.circuitDefinition).isEqualTo(circuit(`Q
                                                                     /
                                                                     -
                                                                     -`));
    assertThat(drag.afterGrab.circuitDefinition).isEqualTo(circuit(`Q
                                                                    /
                                                                    -
                                                                    -`));
    assertThat(drag.hovers.map(e => e.circuitDefinition)).isEqualTo([
        circuit(`Q
                 /
                 -
                 -`),
        circuit(`Q
                 -
                 -
                 -`),
        circuit(`Q
                 /
                 /
                 /`)]);
    assertThat(drag.afterDrop.circuitDefinition).isEqualTo(circuit(`Q
                                                                    /
                                                                    /
                                                                    /`));
    assertThat(drag.afterDropAndTidy.circuitDefinition).isEqualTo(circuit(`Q
                                                                           /
                                                                           /
                                                                           /`));
});

suite.test("dragQft", () => {
    const drag = simulateDrag(`|
                             |-Q-
                             | 0
                             |-/-
                             |
                             |-+-
                             | 1
                             |-+-
                             |`);

    assertThat(drag.beforeGrab.circuitDefinition).isEqualTo(circuit(`Q
                                                                     /
                                                                     -
                                                                     -`));
    assertThat(drag.afterGrab.circuitDefinition).isEqualTo(circuit(`-
                                                                    -
                                                                    -
                                                                    -`));
    assertThat(drag.hovers.map(e => e.circuitDefinition)).isEqualTo([
        circuit(`Q
                 /
                 -
                 -`),
        circuit(`-
                 -
                 Q
                 /`)]);
    assertThat(drag.afterDrop.circuitDefinition).isEqualTo(circuit(`-
                                                                    -
                                                                    Q
                                                                    /`));
    assertThat(drag.afterDropAndTidy.circuitDefinition).isEqualTo(circuit(`-
                                                                           -
                                                                           Q
                                                                           /`));
});
