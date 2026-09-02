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

import {
    findGateOverlappingPos,
    findGateWithButtonContaining,
    findModificationIndex,
    findOpHalfColumnAt,
    findWireWithInitialStateAreaContaining,
    toColumnSpaceCoordinate,
    wireIndexAt,
    wireInitialStateClickableRect,
} from "./CircuitHitTesting.js"
import {DisplayedCircuit} from "./DisplayedCircuit.js"
import {GateColumn} from "../circuit/GateColumn.js"
import {Layout} from "../config/Layout.js"
import {Simulation} from "../config/Simulation.js"
import {Point} from "../math/Point.js"
import {seq} from "../base/Seq.js"

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @returns {!DisplayedCircuit}
 */
function previewDrop(circuit, hand) {
    return hand.heldRow !== undefined ? previewDropMovedRow(circuit, hand) :
        hand.heldColumn !== undefined ? previewDropMovedGateColumn(circuit, hand) :
        hand.heldGate !== undefined ? previewDropMovedGate(circuit, hand) :
        previewResizedGate(circuit, hand);
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @returns {!DisplayedCircuit}
 */
function previewDropMovedRow(circuit, hand) {
    if (hand.pos === undefined) {
        return circuit;
    }
    let handWire = wireIndexAt(circuit, hand.pos.y);
    if (handWire < 0 || handWire >= circuit.circuitDefinition.numWires) {
        // Dragged the row out of the circuit.
        return circuit;
    }

    let heldRowHeight = seq(hand.heldRow.gates).map(g => g === undefined ? 1 : g.height).max(1);
    handWire = Math.min(handWire, circuit.circuitDefinition.numWires - heldRowHeight);

    let newCols = [];
    for (let c = 0; c < circuit.circuitDefinition.columns.length; c++) {
        let gates = [...circuit.circuitDefinition.columns[c].gates];
        gates.splice(handWire, 0, hand.heldRow.gates[c]);
        gates.pop();
        newCols.push(new GateColumn(gates));
    }

    let newInitialStates = seq(circuit.circuitDefinition.customInitialValues.entries()).
        map(([k, v]) => [k + (k >= handWire ? 1 : 0), v]).
        toMap(([k, _]) => k, ([_, v]) => v);
    if (hand.heldRow.initialState !== undefined) {
        newInitialStates.set(handWire, hand.heldRow.initialState);
    }
    let newCircuitDef = circuit.circuitDefinition.withColumns(newCols).withInitialStates(newInitialStates);

    return circuit.withCircuit(newCircuitDef).
        _withHighlightedSlot({row: handWire, col: undefined, resizeStyle: false});
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @returns {!DisplayedCircuit}
 */
function previewDropMovedGateColumn(circuit, hand) {
    if (hand.pos === undefined) {
        return circuit;
    }
    let handWire = wireIndexAt(circuit, hand.pos.y);
    if (handWire < 0 || handWire >= Simulation.MAX_WIRE_COUNT || hand.pos.x <= 1) {
        // Dragged the gate column out of the circuit.
        return circuit;
    }


    let halfCol = findOpHalfColumnAt(circuit, new Point(hand.pos.x, circuit.top));
    let mustInsert = halfCol % 1 === 0 &&
        circuit.circuitDefinition.columns[halfCol] !== undefined &&
        !circuit.circuitDefinition.columns[halfCol].isEmpty();
    if (mustInsert) {
        let isAfter = hand.pos.x > circuit.opRect(halfCol).center().x;
        halfCol += isAfter ? 0.5 : -0.5;
    }

    let col = Math.ceil(halfCol);
    let isInsert = halfCol % 1 !== 0;

    let rowShift = Math.round((hand.pos.y - hand.holdOffset.y - circuit.top) / Layout.WIRE_SPACING);
    let newCircuitDef = shiftAndSpliceColumn(circuit, rowShift, [...hand.heldColumn.gates], col, isInsert);

    return circuit.withCircuit(newCircuitDef).
        _withHighlightedSlot({row: undefined, col, resizeStyle: false}).
        _withCompressedColumnIndex(isInsert ? col : undefined);
}

function shiftAndSpliceColumn(circuit, rowShift, gatesOfCol, insertCol, isInsert) {
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

    let expandedCircuit = circuit.circuitDefinition.withWireCount(gatesOfCol.length);
    let newCols = [...expandedCircuit.columns];

    // Move displays rightward.
    while (newCols.length < insertCol) {
        newCols.push(GateColumn.empty(expandedCircuit.numWires));
    }

    newCols.splice(insertCol, isInsert ? 0 : 1, new GateColumn(gatesOfCol));
    return expandedCircuit.withColumns(newCols).withTrailingSpacersIncluded();
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @returns {!DisplayedCircuit}
 */
function previewDropMovedGate(circuit, hand) {
    let modificationPoint = findModificationIndex(circuit, hand);
    if (modificationPoint === undefined) {
        return circuit;
    }

    // Use the grab offset instead of the gate height so that tall gates are 'sticky' when dragging downward: they
    // aren't removed until the hand actually leaves the circuit area.
    let handRowOffset = Math.floor(hand.holdOffset.y/Layout.WIRE_SPACING);
    if (modificationPoint.row + handRowOffset >= circuit.circuitDefinition.numWires) {
        return circuit;
    }

    let addedGate = hand.heldGate;

    let emptyCol = GateColumn.empty(circuit.circuitDefinition.numWires);
    let i = modificationPoint.col;
    let isInserting = modificationPoint.isInsert;
    let row = Math.min(modificationPoint.row, Math.max(0, Simulation.MAX_WIRE_COUNT - addedGate.height));
    let newCols = seq(circuit.circuitDefinition.columns).
        padded(i, emptyCol).
        ifThen(isInserting, s => s.withInsertedItem(i, emptyCol)).
        padded(i + addedGate.width, emptyCol).
        withTransformedItem(i, c => c.withGatesAdded(row, new GateColumn([addedGate]))).
        toArray();
    let newWireCount = Math.max(
        circuit.geometry().extraWireStartIndex || 0,
        Math.max(
            circuit.circuitDefinition.numWires,
            addedGate.height + row));
    if (newWireCount > Simulation.MAX_WIRE_COUNT) {
        return circuit;
    }

    let newCircuitDef = circuit.circuitDefinition.
        withColumns(newCols).
        withWireCount(newWireCount);
    return circuit.withCircuit(newCircuitDef).
        _withHighlightedSlot({row, col: modificationPoint.col, resizeStyle: false}).
        _withCompressedColumnIndex(isInserting ? i : undefined).
        _withFallbackExtraWireStartIndex(circuit.circuitDefinition.numWires);
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @returns {!DisplayedCircuit}
 */
function previewResizedGate(circuit, hand) {
    if (hand.resizingGateSlot === undefined || hand.pos === undefined) {
        return circuit;
    }
    let gate = circuit.circuitDefinition.gateInSlot(hand.resizingGateSlot.x, hand.resizingGateSlot.y);
    if (gate === undefined) {
        return circuit;
    }
    let row = Math.min(
        wireIndexAt(circuit, hand.pos.y - hand.holdOffset.y),
        Simulation.MAX_WIRE_COUNT - 1);
    let newGate = seq(gate.gateFamily).minBy(g => Math.abs(g.height - (row - hand.resizingGateSlot.y + 1)));
    let newWireCount = Math.min(Simulation.MAX_WIRE_COUNT,
        Math.max(circuit.circuitDefinition.numWires, newGate.height + hand.resizingGateSlot.y));
    let newCols = seq(circuit.circuitDefinition.columns).
        withTransformedItem(hand.resizingGateSlot.x,
            colObj => new GateColumn(seq(colObj.gates).
                withOverlayedItem(hand.resizingGateSlot.y, newGate).
                toArray())).
        toArray();

    let newCircuitWithoutOverlapFix = circuit.circuitDefinition.withColumns(newCols).withWireCount(newWireCount);
    let newCircuitWithOverlapFix = newCircuitWithoutOverlapFix.withHeightOverlapsFixed();
    let newCircuit = newCircuitWithOverlapFix.withTrailingSpacersIncluded();
    return circuit.withCircuit(newCircuit).
        _withHighlightedSlot(circuit._highlightedSlot).
        _withCompressedColumnIndex(newCircuitWithoutOverlapFix.isEqualTo(newCircuitWithOverlapFix) ?
            undefined :
            hand.resizingGateSlot.x + 1).
        _withFallbackExtraWireStartIndex(circuit.circuitDefinition.numWires);
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @returns {!DisplayedCircuit}
 */
function afterDropping(circuit, hand) {
    return previewDrop(circuit, hand)._withCompressedColumnIndex(undefined);
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @param {!int} extraWireCount
 * @returns {!DisplayedCircuit}
 */
function withJustEnoughWires(circuit, hand, extraWireCount) {
    let neededWireCountForPlacement = hand.heldGate !== undefined ? hand.heldGate.height : 0;
    let desiredWireCount = circuit.circuitDefinition.minimumRequiredWireCount();
    let clampedWireCount = Math.min(
        Simulation.MAX_WIRE_COUNT,
        Math.max(
            Math.min(1, neededWireCountForPlacement),
            Math.max(Simulation.MIN_WIRE_COUNT, desiredWireCount) + extraWireCount));
    return circuit.withCircuit(circuit.circuitDefinition.withWireCount(clampedWireCount)).
        _withExtraWireStartIndex(extraWireCount === 0 ? undefined : circuit.circuitDefinition.numWires);
}





/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @returns {undefined|!DisplayedCircuit}
 */
function tryClick(circuit, hand) {
    if (hand.pos === undefined || hand.heldGate !== undefined) {
        return undefined;
    }

    let clickedInitialStateWire = findWireWithInitialStateAreaContaining(circuit, hand.pos);
    if (clickedInitialStateWire !== undefined) {
        return circuit.withCircuit(circuit.circuitDefinition.withSwitchedInitialStateOn(clickedInitialStateWire))
    }

    let found = findGateWithButtonContaining(circuit, hand.pos);
    if (found === undefined || found.gate.onClickGateFunc === undefined) {
        // Gates with a parameter dialog are handled by the pointer code before it tries a click.
        return undefined;
    }

    let newGate = found.gate.onClickGateFunc(found.gate);
    let cols = [...circuit.circuitDefinition.columns];
    let col = cols[found.col];
    let gates = [...col.gates];
    gates.splice(found.row, 1, newGate);
    cols.splice(found.col, 1, new GateColumn(gates));
    return circuit.withCircuit(circuit.circuitDefinition.withColumns(cols));
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @param {!boolean=false} duplicate
 * @param {!boolean=false} wholeColumn
 * @param {!boolean=false} ignoreResizeTabs
 * @param {!boolean=false} alt Whether or not to replace grabbed gates with their alternates.
 * @returns {!{newCircuit: !DisplayedCircuit, newHand: !Hand}}
 */
function tryGrab(circuit, hand, duplicate=false, wholeColumn=false, ignoreResizeTabs=false, alt=false) {
    if (wholeColumn) {
        let grabRowResult = tryGrabRow(circuit, hand, alt);
        if (grabRowResult !== undefined) {
            return grabRowResult;
        }
        return tryGrabWholeColumn(circuit, hand, duplicate, alt) || {newCircuit: circuit, newHand: hand};
    }

    let newHand = hand;
    let newCircuit = circuit;
    if (!ignoreResizeTabs) {
        let resizing = tryGrabResizeTab(circuit, hand);
        if (resizing !== undefined) {
            newHand = resizing.newHand;
            newCircuit = resizing.newCircuit;
        }
    }

    return tryGrabGate(newCircuit, newHand, duplicate, alt) || {newCircuit, newHand};
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @param {!boolean} alt
 * @returns {undefined|!{newCircuit: !DisplayedCircuit, newHand: !Hand}}
 */
function tryGrabRow(circuit, hand, alt) {
    if (hand.pos === undefined) {
        return undefined;
    }

    // Which wire is it? Is it one that's actually in the circuit?
    let wire = wireIndexAt(circuit, hand.pos.y);
    if (wire < 0 || wire >= circuit.circuitDefinition.numWires) {
        return undefined;
    }

    // Is it inside the intended click area, instead of just off to the side?
    let r = wireInitialStateClickableRect(circuit, wire);
    if (!r.containsPoint(hand.pos)) {
        return undefined;
    }

    let {newCircuit, initialState, rowGates} = cutRow(circuit, wire);
    let holdOffset = new Point(0, hand.pos.y - r.y);
    if (alt) {
        rowGates = rowGates.map(e => e === undefined ? e : e.alternate);
    }
    return {
        newCircuit: circuit.withCircuit(newCircuit),
        newHand: hand.withHeldRow({initialState, gates: rowGates}, holdOffset)
    };
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!int} row
 * @returns {!{newCircuit: !CircuitDefinition, rowGates: !Array.<undefined|!Gate>, initialState: *}}
 */
function cutRow(circuit, row) {
    let row_gates = [];
    let cols = [];
    for (let i = 0; i < circuit.circuitDefinition.columns.length; i++) {
        let col_gates = [...circuit.circuitDefinition.columns[i].gates];
        row_gates.push(col_gates[row]);
        col_gates.splice(row, 1);
        col_gates.push(undefined);
        cols.push(new GateColumn(col_gates));
    }
    let newInitialStates = seq(circuit.circuitDefinition.customInitialValues.entries()).
        filter(([k, _]) => k !== row).
        map(([k, v]) => [k - (k > row ? 1 : 0), v]).
        toMap(([k, _]) => k, ([_, v]) => v);
    return {
        newCircuit: circuit.circuitDefinition.withColumns(cols).withInitialStates(newInitialStates),
        rowGates: row_gates,
        initialState: circuit.circuitDefinition.customInitialValues.get(row)
    };
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @param {!boolean} duplicate
 * @param {!boolean} alt
 * @returns {undefined|!{newCircuit: !DisplayedCircuit, newHand: !Hand}}
 */
function tryGrabGate(circuit, hand, duplicate, alt) {
    if (hand.isBusy() || hand.pos === undefined) {
        return undefined;
    }

    let foundPt = findGateOverlappingPos(circuit, hand.pos);
    if (foundPt === undefined) {
        return undefined;
    }

    let {col, row, offset} = foundPt;
    let gate = circuit.circuitDefinition.columns[col].gates[row];
    if (alt) {
        gate = gate.alternate;
    }

    let remainingGates = seq(circuit.circuitDefinition.columns[col].gates).toArray();
    if (!duplicate) {
        remainingGates[row] = undefined;
    }

    let newCols = seq(circuit.circuitDefinition.columns).
        withOverlayedItem(col, new GateColumn(remainingGates)).
        toArray();
    return {
        newCircuit: new DisplayedCircuit(
            circuit.top,
            circuit.circuitDefinition.withColumns(newCols),
            undefined,
            undefined,
            circuit.geometry().extraWireStartIndex),
        newHand: hand.withHeldGate(gate, offset)
    };
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @returns {!{newCircuit: !DisplayedCircuit, newHand: !Hand}}
 */
function tryGrabResizeTab(circuit, hand) {
    if (hand.isBusy() || hand.pos === undefined) {
        return undefined;
    }

    for (let col = 0; col < circuit.circuitDefinition.columns.length; col++) {
        for (let row = 0; row < circuit.circuitDefinition.numWires; row++) {
            let gate = circuit.circuitDefinition.columns[col].gates[row];
            if (gate === undefined) {
                continue;
            }
            let {isResizeHighlighted} =
                circuit._highlightStatusAt(col, row, hand.hoverPoints());
            if (isResizeHighlighted) {
                let offset = hand.pos.minus(circuit.gateRect(row + gate.height - 1, col, 1, 1).center());
                return {
                    newCircuit: circuit._withHighlightedSlot({col, row, resizeStyle: true}),
                    newHand: hand.withResizeSlot(new Point(col, row), offset)
                };
            }
        }
    }
    return undefined;
}

/**
 * @param {!DisplayedCircuit} circuit
 * @param {!Hand} hand
 * @param {!boolean} duplicate
 * @param {!boolean} alt Whether or not to replace grabbed gates with their alternates.
 * @returns {undefined|!{newCircuit: !DisplayedCircuit, newHand: !Hand}}
 */
function tryGrabWholeColumn(circuit, hand, duplicate, alt) {
    if (hand.isBusy() || hand.pos === undefined) {
        return undefined;
    }

    let col = Math.round(toColumnSpaceCoordinate(circuit, hand.pos.x));
    if (col < 0 || col >= circuit.circuitDefinition.columns.length || circuit.circuitDefinition.columns[col].isEmpty()) {
        return undefined;
    }

    let newCols = [...circuit.circuitDefinition.columns];
    if (!duplicate) {
        newCols.splice(col, 1, GateColumn.empty(circuit.circuitDefinition.numWires));
    }

    let holdOffset = new Point(0, wireIndexAt(circuit, hand.pos.y) * Layout.WIRE_SPACING + Layout.WIRE_SPACING/2);
    let grabbedGates = circuit.circuitDefinition.columns[col];
    if (alt) {
        grabbedGates = new GateColumn(grabbedGates.gates.map(e => e === undefined ? e : e.alternate));
    }
    return {
        newCircuit: circuit.withCircuit(circuit.circuitDefinition.withColumns(newCols)),
        newHand: hand.withHeldGateColumn(grabbedGates, holdOffset)
    };
}

export {
    previewDrop,
    afterDropping,
    withJustEnoughWires,
    tryClick,
    tryGrab,
}
