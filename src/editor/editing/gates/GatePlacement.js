import {Point} from '../../../geometry/Point.js';
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

import {findOpHalfColumnAt, indexOfDisplayedRowAt} from '../../interaction/CircuitHitTesting.js';
import {GateColumn} from '../../../circuit/model/GateColumn.js';
import {Layout} from '../../../config/Layout.js';
import {Simulation} from '../../../config/Simulation.js';

/**
 * @param {!Object} context Definition, geometry and editing queries supplied by CircuitEditing.
 * @param {!PointerInteractionState} hand
 * @returns {undefined|!Object} Proposed definition and drag-state changes; undefined means no edit.
 */
function previewDropMovedGate(context, hand) {
    const modificationPoint = findModificationIndex(context.geometry, hand);
    if (modificationPoint === undefined) {
        return undefined;
    }

    // Use the grab offset instead of the gate height so that tall gates are 'sticky' when dragging downward: they
    // aren't removed until the hand actually leaves the circuit area.
    const handRowOffset = Math.floor(hand.holdOffset.y/Layout.WIRE_SPACING);
    if (modificationPoint.row + handRowOffset >= context.definition.numWires) {
        return undefined;
    }

    const addedGate = hand.heldGate;

    const emptyCol = GateColumn.empty(context.definition.numWires);
    const i = modificationPoint.col;
    const isInserting = modificationPoint.isInsert;
    const row = Math.min(modificationPoint.row, Math.max(0, Simulation.MAX_WIRE_COUNT - addedGate.height));
    // Pad out to the drop column, open a slot if this is an insert, then pad out far enough
    // for the gate's full width before folding it into the column it lands on.
    const newCols = [...context.definition.columns];
    while (newCols.length < i) {
        newCols.push(emptyCol);
    }
    if (isInserting) {
        newCols.splice(i, 0, emptyCol);
    }
    while (newCols.length < i + addedGate.width) {
        newCols.push(emptyCol);
    }
    newCols[i] = newCols[i].withGatesAdded(row, new GateColumn([addedGate]));
    const newWireCount = Math.max(
        context.geometry.extraWireStartIndex || 0,
        Math.max(
            context.definition.numWires,
            addedGate.height + row));
    if (newWireCount > Simulation.MAX_WIRE_COUNT) {
        return undefined;
    }

    const newCircuitDef = context.definition.
        withColumns(newCols).
        withWireCount(newWireCount);
    return {
        definition: newCircuitDef,
        highlightedSlot: {row, col: modificationPoint.col, resizeStyle: false},
        compressedColumnIndex: isInserting ? i : undefined,
        extraWireStartIndex: context.geometry.extraWireStartIndex || context.definition.numWires
    };
}

/**
 * @param {!Object} context Definition, geometry and editing queries supplied by CircuitEditing.
 * @param {!PointerInteractionState} hand
 * @param {!boolean} duplicate
 * @param {!boolean} alt
 * @returns {undefined|!Object} Proposed definition, drag-state and hand changes.
 */
function tryGrabGate(context, hand, duplicate, alt) {
    if (hand.isBusy() || hand.pos === undefined) {
        return undefined;
    }

    const foundPt = context.findGateOverlappingPos(hand.pos);
    if (foundPt === undefined) {
        return undefined;
    }

    const {col, row, offset} = foundPt;
    let gate = context.definition.columns[col].gates[row];
    if (alt) {
        gate = gate.alternate;
    }

    const remainingGates = [...context.definition.columns[col].gates];
    if (!duplicate) {
        remainingGates[row] = undefined;
    }

    const newCols = context.definition.columns.
        with(col, new GateColumn(remainingGates));
    return {
        definition: context.definition.withColumns(newCols),
        compressedColumnIndex: undefined,
        highlightedSlot: undefined,
        hand: hand.withHeldGate(gate, offset)
    };
}

export {previewDropMovedGate, tryGrabGate};

/**
 * @param {!CircuitGeometry} geometry
 * @param {!PointerInteractionState} hand
 * @returns {undefined|!{col: !int, row: !int, halfColIndex: !number}}
 */
function findModificationIndex_helperColRow(geometry, hand) {
  if (hand.pos === undefined || hand.heldGate === undefined) {
    return undefined;
  }
  const pos = hand.pos
    .minus(hand.holdOffset)
    .plus(new Point(Layout.GATE_RADIUS, Layout.GATE_RADIUS));
  const halfColIndex = findOpHalfColumnAt(geometry, pos);
  const row = indexOfDisplayedRowAt(geometry, pos.y);
  if (halfColIndex === undefined || row === undefined) {
    return undefined;
  }
  const col = Math.ceil(halfColIndex);
  return { col, row, halfColIndex };
}

/**
 * @param {!CircuitGeometry} geometry
 * @param {!PointerInteractionState} hand
 * @returns {?{ col : !number, row : !number, isInsert : !boolean }}
 */
function findModificationIndex(geometry, hand) {
  const loc = findModificationIndex_helperColRow(geometry, hand);
  if (loc === undefined) {
    return undefined;
  }
  let { col, row, halfColIndex } = loc;

  let isInsert = Math.abs(halfColIndex % 1) === 0.5;
  if (col >= geometry.circuitDefinition.columns.length) {
    return { col: col, row: row, isInsert: isInsert };
  }

  if (!isInsert) {
    const mustInsert =
      geometry.circuitDefinition.isSlotRectCoveredByGateInSameColumn(
        col,
        row,
        hand.heldGate.height,
      );
    if (mustInsert) {
      const isAfter = hand.pos.x > geometry.opRect(col).center().x;
      isInsert = true;
      if (isAfter) {
        col += 1;
      }
    }
  }

  return { col: col, row: row, isInsert: isInsert };
}

