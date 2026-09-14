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
import {Simulation} from '../../../config/Simulation.js';
import {Point} from '../../../geometry/Point.js';

/**
 * @param {!Object} context Definition, geometry and editing queries supplied by CircuitEditing.
 * @param {!PointerInteractionState} hand
 * @returns {undefined|!Object} Proposed definition and drag-state changes; undefined means no edit.
 */
function previewResizedGate(context, hand) {
    if (hand.resizingGateSlot === undefined || hand.pos === undefined) {
        return undefined;
    }
    const gate = context.definition.gateInSlot(hand.resizingGateSlot.x, hand.resizingGateSlot.y);
    if (gate === undefined) {
        return undefined;
    }
    const row = Math.min(
        context.wireIndexAt(hand.pos.y - hand.holdOffset.y),
        Simulation.MAX_WIRE_COUNT - 1);
    const desiredHeight = row - hand.resizingGateSlot.y + 1;
    // Strict comparison keeps the first family member when heights are equally close.
    const newGate = gate.gateFamily.reduce((best, candidate) =>
        Math.abs(candidate.height - desiredHeight) < Math.abs(best.height - desiredHeight) ? candidate : best);
    const newWireCount = Math.min(Simulation.MAX_WIRE_COUNT,
        Math.max(context.definition.numWires, newGate.height + hand.resizingGateSlot.y));
    const resizedColumn = new GateColumn(
        context.definition.columns[hand.resizingGateSlot.x].gates.
            with(hand.resizingGateSlot.y, newGate));
    const newCols = context.definition.columns.
        with(hand.resizingGateSlot.x, resizedColumn);

    const newCircuitWithoutOverlapFix = context.definition.withColumns(newCols).withWireCount(newWireCount);
    const newCircuitWithOverlapFix = newCircuitWithoutOverlapFix.withHeightOverlapsFixed();
    const newCircuit = newCircuitWithOverlapFix.withTrailingSpacersIncluded();
    return {
        definition: newCircuit,
        compressedColumnIndex: newCircuitWithoutOverlapFix.isEqualTo(newCircuitWithOverlapFix) ?
            undefined : hand.resizingGateSlot.x + 1,
        extraWireStartIndex: context.geometry.extraWireStartIndex || context.definition.numWires
    };
}

/**
 * @param {!Object} context Definition, geometry and editing queries supplied by CircuitEditing.
 * @param {!PointerInteractionState} hand
 * @returns {undefined|!Object} Proposed definition, drag-state and hand changes.
 */
function tryGrabResizeTab(context, hand) {
    if (hand.isBusy() || hand.pos === undefined) {
        return undefined;
    }

    for (let col = 0; col < context.definition.columns.length; col++) {
        for (let row = 0; row < context.definition.numWires; row++) {
            const gate = context.definition.columns[col].gates[row];
            if (gate === undefined) {
                continue;
            }
            const {isResizeHighlighted} =
                context.highlightStatusAt(col, row, hand.hoverPoints());
            if (isResizeHighlighted) {
                const offset = hand.pos.minus(context.geometry.gateRect(row + gate.height - 1, col, 1, 1).center());
                return {
                    highlightedSlot: {col, row, resizeStyle: true},
                    hand: hand.withResizeSlot(new Point(col, row), offset)
                };
            }
        }
    }
    return undefined;
}

export {previewResizedGate, tryGrabResizeTab};
