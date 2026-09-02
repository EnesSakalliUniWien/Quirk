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

import {Layout} from "../config/Layout.js"
import {GatePainting} from "../draw/GatePainting.js"
import {Hand} from "../ui/Hand.js"
import {Point} from "../math/Point.js"
import {Rect} from "../math/Rect.js"
import {CIRCUIT_OP_HORIZONTAL_SPACING, CIRCUIT_OP_LEFT_SPACING} from "./CircuitLayoutConstants.js"

/**
 * Maps a position on the canvas back to what is under it: a wire, a column, a gate, a resize
 * tab. Pure queries over a circuit, unlike tryGrab and tryClick, which answer a pointer by
 * returning an edited circuit and so stay with the class.
 */

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!number} y
 * @returns {!int}
 */
function wireIndexAt(circuit, y) {
    return Math.floor((y - circuit.top) / Layout.WIRE_SPACING);
}

//noinspection JSMethodCanBeStatic
/**
 * @param {!DisplayedCircuit} circuit
 * @param {!number} x
 * @returns {!number} The continuous column-space coordinate corresponding to the given display-space coordinate.
 */
function toColumnSpaceCoordinate(circuit, x) {
    let spacing = (CIRCUIT_OP_HORIZONTAL_SPACING + Layout.GATE_RADIUS * 2);
    let left = CIRCUIT_OP_LEFT_SPACING - CIRCUIT_OP_HORIZONTAL_SPACING / 2;
    return (x - left) / spacing - 0.5;
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!number} y
 * @returns {undefined|!int}
 */
function indexOfDisplayedRowAt(circuit, y) {
    let i = Math.floor((y - circuit.top) / Layout.WIRE_SPACING);
    if (i < 0 || i >= circuit.circuitDefinition.numWires) {
        return undefined;
    }
    return i;
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!number} x
 * @returns {undefined|!int}
 */
function indexOfDisplayedColumnAt(circuit, x) {
    let col = toColumnSpaceCoordinate(circuit, x);
    let compressedColumnIndex = circuit.geometry().compressedColumnIndex;
    let i;
    if (compressedColumnIndex === undefined || col < compressedColumnIndex - 0.75) {
        i = Math.round(col);
    } else if (col < compressedColumnIndex - 0.25) {
        i = compressedColumnIndex;
    } else {
        i = Math.round(col) - 1;
    }

    if (i < 0 || i >= circuit.circuitDefinition.columns.length) {
        return undefined;
    }

    return i;
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Point} p
 * @returns {undefined|!number}
 */
function findOpHalfColumnAt(circuit, p) {
    if (p.x < 0 || p.y < circuit.top || p.y > circuit.top + circuit.desiredHeight()) {
        return undefined;
    }

    return Math.max(-0.5, Math.round(toColumnSpaceCoordinate(circuit, p.x) * 2) / 2);
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @returns {undefined|!{col: !int, row: !int, halfColIndex: !number}}
 */
function findModificationIndex_helperColRow(circuit, hand) {
    if (hand.pos === undefined || hand.heldGate === undefined) {
        return undefined;
    }
    let pos = hand.pos.minus(hand.holdOffset).plus(new Point(Layout.GATE_RADIUS, Layout.GATE_RADIUS));
    let halfColIndex = findOpHalfColumnAt(circuit, pos);
    let row = indexOfDisplayedRowAt(circuit, pos.y);
    if (halfColIndex === undefined || row === undefined) {
        return undefined;
    }
    let col = Math.ceil(halfColIndex);
    return {col, row, halfColIndex};
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @returns {?{ col : !number, row : !number, isInsert : !boolean }}
 */
function findModificationIndex(circuit, hand) {
    let loc = findModificationIndex_helperColRow(circuit, hand);
    if (loc === undefined) {
        return undefined;
    }
    let {col, row, halfColIndex} = loc;

    let isInsert = Math.abs(halfColIndex % 1) === 0.5;
    if (col >= circuit.circuitDefinition.columns.length) {
        return {col: col, row: row, isInsert: isInsert};
    }

    if (!isInsert) {
        let mustInsert = circuit.circuitDefinition.isSlotRectCoveredByGateInSameColumn(
            col, row, hand.heldGate.height);
        if (mustInsert) {
            let isAfter = hand.pos.x > circuit.opRect(col).center().x;
            isInsert = true;
            if (isAfter) {
                col += 1;
            }
        }
    }

    return {col: col, row: row, isInsert: isInsert};
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Point} pos
 * @returns {undefined|!{col: !int, row: !int, offset: !Point}}
 */
function findGateOverlappingPos(circuit, pos) {
    let col = indexOfDisplayedColumnAt(circuit, pos.x);
    let row = indexOfDisplayedRowAt(circuit, pos.y);
    if (col === undefined || row === undefined) {
        return undefined;
    }

    let target = circuit.circuitDefinition.findGateCoveringSlot(col, row);
    if (target === undefined) {
        return undefined;
    }

    let gateRect = circuit.gateRect(target.row, target.col, target.gate.width, target.gate.height);
    if (!gateRect.containsPoint(pos)) {
        return undefined;
    }

    return {col: target.col, row: target.row, offset: pos.minus(gateRect.topLeft())};
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Point} pos
 * @returns {undefined|!{col: !int, row: !int, gate: !Gate}}
 */
function findGateWithButtonContaining(circuit, pos) {
    let foundPt = findGateOverlappingPos(circuit, pos);
    if (foundPt === undefined) {
        return undefined;
    }

    let gate = circuit.circuitDefinition.gateInSlot(foundPt.col, foundPt.row);
    if (gate.onClickGateFunc === undefined && gate.paramDialog === undefined) {
        return undefined;
    }

    let buttonRect = GatePainting.gateButtonRect(circuit.gateRect(foundPt.row, foundPt.col, gate.width, gate.height));
    if (!buttonRect.containsPoint(pos)) {
        return undefined;
    }

    return {col: foundPt.col, row: foundPt.row, gate};
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!int} wire
 * @returns {!Rect}
 */
function wireInitialStateClickableRect(circuit, wire) {
    let r = circuit.wireRect(wire);
    r.x = 0;
    r.y += 5;
    r.w = 30;
    r.h -= 10;
    return r;
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Point} pt
 * @returns {undefined|!int}
 */
function findWireWithInitialStateAreaContaining(circuit, pt) {
    // Is it in the right vertical band; the one at the start of the circuit?
    if (pt.x < 0 || pt.x > 30) {
        return undefined;
    }

    // Which wire is it? Is it one that's actually in the circuit?
    let wire = wireIndexAt(circuit, pt.y);
    if (wire < 0 || wire >= circuit.circuitDefinition.numWires) {
        return undefined;
    }

    // Is it inside the intended click area, instead of just off to the side?
    let r = wireInitialStateClickableRect(circuit, wire);
    if (!r.containsPoint(pt)) {
        return undefined;
    }

    // Good to go.
    return wire;
}

export {wireIndexAt, toColumnSpaceCoordinate, indexOfDisplayedRowAt, indexOfDisplayedColumnAt, findOpHalfColumnAt, findModificationIndex_helperColRow, findModificationIndex, findGateOverlappingPos, findGateWithButtonContaining, wireInitialStateClickableRect, findWireWithInitialStateAreaContaining}
