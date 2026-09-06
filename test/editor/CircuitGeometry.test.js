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

import {Suite, assertThat, assertTrue} from "../TestUtil.js"
import {CircuitDefinition} from "../../src/circuit/model/CircuitDefinition.js"
import {CircuitGeometry} from "../../src/editor/CircuitGeometry.js"
import {Gates, INITIAL_STATES_TO_GATES} from "../../src/gates/AllGates.js"
import {Layout} from "../../src/config/Layout.js"
import {Simulation} from "../../src/config/Simulation.js"
import {DisplayedCircuit} from "../../src/editor/DisplayedCircuit.js"
import {Point} from "../../src/math/Point.js"
import {findGateOverlappingPos, findWireWithInitialStateAreaContaining} from "../../src/editor/CircuitHitTesting.js"
import {Typography} from "../../src/config/Typography.js"
import {Hand} from "../../src/editor/Hand.js"

let suite = new Suite("CircuitGeometry");

suite.test("Register labels fit, ket hits stay within their control, and insertion clears the gutter", () => {
    const displayed = DisplayedCircuit.empty(0).withCircuit(new CircuitDefinition(Simulation.MAX_WIRE_COUNT, []));
    const g = displayed.geometry();
    const ctx = document.createElement('canvas').getContext('2d');
    for (let row = 0; row < Simulation.MAX_WIRE_COUNT; row++) {
        const index = g.wireIndexRect(row), ket = g.wireInitialStateRect(row);
        ctx.font = `${Layout.REGISTER_FONT_SIZE}px ${Typography.MONO_FONT_FAMILY}`;
        assertTrue(ctx.measureText(`q${row}`).width <= index.w);
        ctx.font = `${Layout.REGISTER_FONT_SIZE}px ${Typography.DEFAULT_FONT_FAMILY}`;
        for (const state of INITIAL_STATES_TO_GATES.keys()) {
            assertTrue(ctx.measureText(`|${state || '0'}⟩`).width <= ket.w - Layout.REGISTER_MARGIN);
        }
        assertTrue(index.right() < ket.x && ket.bottom() < g.wireRect(row).bottom());
        assertThat(findWireWithInitialStateAreaContaining(displayed, ket.center())).isEqualTo(row);
        assertThat(findWireWithInitialStateAreaContaining(displayed, index.center())).isEqualTo(undefined);
        assertThat(findWireWithInitialStateAreaContaining(displayed, new Point(ket.center().x, ket.bottom() + 1))).isEqualTo(undefined);
        assertThat(displayed.tryClick(Hand.EMPTY.withPos(ket.center())).circuitDefinition.customInitialValues.get(row)).isEqualTo('1');
    }
    const preview = new CircuitGeometry(0, g.circuitDefinition, 0, undefined, 0);
    assertTrue(preview.gateDrawRect(0, 0, Gates.Displays.BlochSphereDisplay).x > g.wireInitialStateRect(0).right());
});

suite.test("Bloch bounds fit their row and column and include the enlarged click area", () => {
    let definition = CircuitDefinition.fromTextDiagram(new Map([['B', Gates.Displays.BlochSphereDisplay]]), 'BB\nBB');
    let displayed = DisplayedCircuit.empty(0).withCircuit(definition);
    let g = displayed.geometry();
    let gate = Gates.Displays.BlochSphereDisplay;
    let rect = g.gateDrawRect(0, 0, gate);
    assertTrue(rect.w > g.gateRect(0, 0).w);
    assertTrue(rect.right() < g.gateDrawRect(0, 1, gate).x);
    assertTrue(rect.bottom() < g.gateDrawRect(1, 0, gate).y);
    assertTrue(rect.y >= g.wireRect(0).y && rect.bottom() <= g.wireRect(0).bottom());
    let edge = new Point(rect.x + 1, rect.center().y);
    assertThat(displayed.findBlochSphereContaining(edge)).isEqualTo({row: 0, col: 0});
    let found = findGateOverlappingPos(displayed, edge);
    // Drag offsets remain relative to the logical slot, even when grabbed outside that slot.
    assertThat(found.offset).isEqualTo(edge.minus(g.gateRect(0, 0).topLeft()));
});

suite.test("multi-column and multi-wire gates use their respective spacing", () => {
    let g = plainGeometry();
    let rect = g.gateRect(0, 0, 2, 2);
    assertThat(rect.w).isEqualTo(2 * Layout.GATE_RADIUS + Layout.COLUMN_SPACING);
    assertThat(rect.h).isEqualTo(2 * Layout.GATE_RADIUS + Layout.WIRE_SPACING);
});

const circuit = diagram => CircuitDefinition.fromTextDiagram(new Map([
    ['H', Gates.HalfTurns.H],
    ['-', undefined]
]), diagram);

const plainGeometry = (top=10) => new CircuitGeometry(top, circuit(`H-
                                                                    --`), undefined, undefined, 0);

suite.test("wires stack down from the top at the wire spacing", () => {
    let g = plainGeometry(10);

    assertThat(g.wireRect(0).y).isEqualTo(10);
    assertThat(g.wireRect(2).y).isEqualTo(10 + 2 * Layout.WIRE_SPACING);
    assertThat(g.wireRect(0).h).isEqualTo(Layout.WIRE_SPACING);
});

suite.test("a gate rect is centered on its column and wire", () => {
    let g = plainGeometry();
    let gate = g.gateRect(1, 2);
    let op = g.opRect(2);
    let wire = g.wireRect(1);

    assertThat(gate.center().x).isApproximatelyEqualTo(op.center().x, 1);
    assertThat(gate.center().y).isApproximatelyEqualTo(wire.center().y, 1);
    assertThat(gate.w).isEqualTo(2 * Layout.GATE_RADIUS);
});

suite.test("a compressed column pinches itself and shifts everything after it", () => {
    let plain = plainGeometry();
    let pinched = new CircuitGeometry(10, circuit(`H-
                                                    --`), 1, undefined, 0);

    // Columns before the pinch stay put; the pinched column loses half a slot; later ones a whole one.
    assertThat(pinched.opRect(0).x).isEqualTo(plain.opRect(0).x);
    assertTrue(pinched.opRect(1).x < plain.opRect(1).x);
    assertThat(plain.opRect(3).x - pinched.opRect(3).x).
        isEqualTo(2 * Layout.GATE_RADIUS + plain.opRect(1).x - plain.opRect(0).x - 2 * Layout.GATE_RADIUS);
});

suite.test("the display shift moves only the output display columns", () => {
    let g0 = plainGeometry();
    let shifted = new CircuitGeometry(10, circuit(`H-
                                                    --`), undefined, undefined, 300);
    let lastCircuitCol = g0.clampedCircuitColCount();

    assertThat(shifted.opRect(0).x).isEqualTo(g0.opRect(0).x);
    assertThat(shifted.opRect(lastCircuitCol).x).isEqualTo(g0.opRect(lastCircuitCol).x);
    assertThat(shifted.opRect(lastCircuitCol + 1).x).isEqualTo(g0.opRect(lastCircuitCol + 1).x + 300);
    assertThat(shifted.rectForSuperpositionDisplay().x).
        isEqualTo(g0.rectForSuperpositionDisplay().x + 300);
});

suite.test("a temporary drag wire is not counted as grounded", () => {
    // Three wires, because at the two-wire minimum the clamp hides the discount being tested.
    let threeWires = `H-
                      --
                      --`;
    let noExtra = new CircuitGeometry(0, circuit(threeWires), undefined, undefined, 0);
    let withExtra = new CircuitGeometry(0, circuit(threeWires), undefined, 2, 0);
    // At the wire limit there is no temporary wire to discount.
    let atLimit = new CircuitGeometry(0, circuit(threeWires), undefined, Simulation.MAX_WIRE_COUNT, 0);

    assertThat(withExtra.groundedWireCount()).isEqualTo(noExtra.groundedWireCount() - 1);
    assertThat(atLimit.importantWireCount()).isEqualTo(withExtra.importantWireCount() + 1);
});

suite.test("the desired size contains every drawn rect", () => {
    let g = plainGeometry(0);
    let grid = g.rectForSuperpositionDisplay();

    assertTrue(g.desiredWidth() > grid.right());
    assertTrue(g.desiredHeight() >= g.wireRect(g.groundedWireCount() - 1).bottom() - g.top);
});
