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

import {GateColumn} from '../../../circuit/model/GateColumn.js';
import {Layout} from '../../../config/Layout.js';
import {Simulation} from '../../../config/Simulation.js';
import {Point} from '../../../geometry/Point.js';

/**
 * @param {!Object} context Definition, geometry and editing queries supplied by CircuitEditing.
 * @param {!PointerInteractionState} hand
 * @returns {undefined|!Object} Proposed definition and drag-state changes; undefined means no edit.
 */
function previewDropMovedGateColumn(context, hand) {
    if (hand.pos === undefined) {
        return undefined;
    }
    const handWire = context.wireIndexAt(hand.pos.y);
    if (handWire < 0 || handWire >= Simulation.MAX_WIRE_COUNT || hand.pos.x <= 1) {
        // Dragged the gate column out of the circuit.
        return undefined;
    }


    let halfCol = context.findOpHalfColumnAt(new Point(hand.pos.x, context.geometry.top));
    const mustInsert = halfCol % 1 === 0 &&
        context.definition.columns[halfCol] !== undefined &&
        !context.definition.columns[halfCol].isEmpty();
    if (mustInsert) {
        const isAfter = hand.pos.x > context.geometry.opRect(halfCol).center().x;
        halfCol += isAfter ? 0.5 : -0.5;
    }

    const col = Math.ceil(halfCol);
    const isInsert = halfCol % 1 !== 0;

    const rowShift = Math.round((hand.pos.y - hand.holdOffset.y - context.geometry.top) / Layout.WIRE_SPACING);
    const newCircuitDef = shiftAndSpliceColumn(context, rowShift, [...hand.heldColumn.gates], col, isInsert);

    return {
        definition: newCircuitDef,
        highlightedSlot: {row: undefined, col, resizeStyle: false},
        compressedColumnIndex: isInsert ? col : undefined
    };
}

function shiftAndSpliceColumn(context, rowShift, gatesOfCol, insertCol, isInsert) {
    // Move gates upward.
    while (rowShift < 0 && gatesOfCol[0] === undefined) {
        gatesOfCol.shift();
        gatesOfCol.push(undefined);
        rowShift += 1;
    }

    // Shift gates downward.
    while (rowShift > 0 && new GateColumn(gatesOfCol).minimumRequiredWireCount() < Simulation.MAX_WIRE_COUNT) {
        gatesOfCol.unshift(undefined);
        if (new GateColumn(gatesOfCol).minimumRequiredWireCount() < gatesOfCol.length) {
            gatesOfCol.pop();
        }
        rowShift -= 1;
    }

    const expandedCircuit = context.definition.withWireCount(gatesOfCol.length);
    const newCols = [...expandedCircuit.columns];

    // Move displays rightward.
    while (newCols.length < insertCol) {
        newCols.push(GateColumn.empty(expandedCircuit.numWires));
    }

    newCols.splice(insertCol, isInsert ? 0 : 1, new GateColumn(gatesOfCol));
    return expandedCircuit.withColumns(newCols).withTrailingSpacersIncluded();
}

/**
 * @param {!Object} context Definition, geometry and editing queries supplied by CircuitEditing.
 * @param {!PointerInteractionState} hand
 * @param {!boolean} duplicate
 * @param {!boolean} alt Whether or not to replace grabbed gates with their alternates.
 * @returns {undefined|!Object} Proposed definition, drag-state and hand changes.
 */
function tryGrabWholeColumn(context, hand, duplicate, alt) {
    if (hand.isBusy() || hand.pos === undefined) {
        return undefined;
    }

    const col = Math.round(context.toColumnSpaceCoordinate(hand.pos.x));
    if (col < 0 || col >= context.definition.columns.length || context.definition.columns[col].isEmpty()) {
        return undefined;
    }

    const newCols = [...context.definition.columns];
    if (!duplicate) {
        newCols.splice(col, 1, GateColumn.empty(context.definition.numWires));
    }

    const holdOffset = new Point(0, context.wireIndexAt(hand.pos.y) * Layout.WIRE_SPACING + Layout.WIRE_SPACING/2);
    let grabbedGates = context.definition.columns[col];
    if (alt) {
        grabbedGates = new GateColumn(grabbedGates.gates.map(e => e === undefined ? e : e.alternate));
    }
    return {
        definition: context.definition.withColumns(newCols),
        hand: hand.withHeldGateColumn(grabbedGates, holdOffset)
    };
}

export {previewDropMovedGateColumn, tryGrabWholeColumn};
